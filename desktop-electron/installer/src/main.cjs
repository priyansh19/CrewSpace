/**
 * CrewSpace Installer Wizard — Electron main process
 *
 * A lightweight frameless window that hosts the React installer UI.
 * Handles file extraction, shortcut creation, and app launching.
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const util = require("util");

const execAsync = util.promisify(exec);

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow = null;

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 960,
    minHeight: 640,
    center: true,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "CrewSpace Setup",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5275/");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const distPath = path.join(__dirname, "../renderer-dist/index.html");
    mainWindow.loadFile(distPath);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ── Installation helpers ────────────────────────────────────────────────────

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

function getPayloadPath() {
  if (isDev) {
    return path.join(__dirname, "..", "assets", "payload", "app.zip");
  }
  return path.join(process.resourcesPath, "assets", "payload", "app.zip");
}

async function extractZip(zipPath, targetDir, onProgress) {
  // Ensure target exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Use PowerShell Expand-Archive (built into Windows)
  const safeZip = zipPath.replace(/'/g, "''");
  const safeTarget = targetDir.replace(/'/g, "''");
  const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${safeZip}' -DestinationPath '${safeTarget}' -Force"`;

  onProgress?.({ percent: 5, stage: "extract", detail: "Starting extraction…" });

  await execAsync(cmd);

  onProgress?.({ percent: 70, stage: "extract", detail: "Extraction complete" });
}

async function createShortcut(exePath, shortcutPath) {
  const safeExe = exePath.replace(/'/g, "''");
  const safeDir = path.dirname(exePath).replace(/'/g, "''");
  const safeShortcut = shortcutPath.replace(/'/g, "''");

  const ps = `
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('${safeShortcut}')
    $Shortcut.TargetPath = '${safeExe}'
    $Shortcut.WorkingDirectory = '${safeDir}'
    $Shortcut.Save()
  `;

  await execAsync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\"')}"`);
}

async function createShortcuts(exePath, { desktop = true, startMenu = true } = {}) {
  const results = [];

  if (desktop) {
    const desktopPath = path.join(os.homedir(), "Desktop", "CrewSpace.lnk");
    await createShortcut(exePath, desktopPath);
    results.push(desktopPath);
  }

  if (startMenu) {
    const startMenuDir = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs"
    );
    if (!fs.existsSync(startMenuDir)) {
      fs.mkdirSync(startMenuDir, { recursive: true });
    }
    const startMenuPath = path.join(startMenuDir, "CrewSpace.lnk");
    await createShortcut(exePath, startMenuPath);
    results.push(startMenuPath);
  }

  return results;
}

// ── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle("install", async () => {
  const dataDir = getAppDataDir();
  const targetDir = path.join(dataDir, "app");
  const zipPath = getPayloadPath();

  try {
    // Check payload exists
    if (!fs.existsSync(zipPath)) {
      throw new Error(`Payload not found: ${zipPath}`);
    }

    // Clean previous install
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // Extract
    await extractZip(zipPath, targetDir, (progress) => {
      mainWindow?.webContents.send("install-progress", progress);
    });

    // Find the actual exe (might be nested one level if zip contains a folder)
    let exePath = path.join(targetDir, "CrewSpace.exe");
    if (!fs.existsSync(exePath)) {
      // Look one level deeper
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const subDir = entries.find((e) => e.isDirectory());
      if (subDir) {
        const nestedExe = path.join(targetDir, subDir.name, "CrewSpace.exe");
        if (fs.existsSync(nestedExe)) {
          exePath = nestedExe;
        }
      }
    }

    // Create shortcuts
    mainWindow?.webContents.send("install-progress", {
      percent: 85,
      stage: "shortcuts",
      detail: "Creating shortcuts…",
    });

    await createShortcuts(exePath);

    mainWindow?.webContents.send("install-progress", {
      percent: 100,
      stage: "done",
      detail: "Installation complete",
    });

    return { success: true, installPath: targetDir, exePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    mainWindow?.webContents.send("install-progress", {
      percent: 0,
      stage: "done",
      detail: `Error: ${message}`,
    });
    throw new Error(message);
  }
});

ipcMain.handle("launch-app", async () => {
  const appPath = path.join(getAppDataDir(), "app", "CrewSpace.exe");
  if (fs.existsSync(appPath)) {
    spawn(appPath, [], { detached: true, shell: false });
  } else {
    // Try nested
    const targetDir = path.join(getAppDataDir(), "app");
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const subDir = entries.find((e) => e.isDirectory());
    if (subDir) {
      const nested = path.join(targetDir, subDir.name, "CrewSpace.exe");
      if (fs.existsSync(nested)) {
        spawn(nested, [], { detached: true, shell: false });
      }
    }
  }
  return { success: true };
});

ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("open-install-folder", async () => {
  const folder = path.join(getAppDataDir(), "app");
  await shell.openPath(folder);
});

ipcMain.on("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.on("close-window", () => {
  mainWindow?.close();
});

// ── App lifecycle ───────────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
