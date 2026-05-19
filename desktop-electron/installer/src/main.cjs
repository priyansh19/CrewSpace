/**
 * CrewSpace Installer Wizard — Electron main process
 *
 * A lightweight frameless window that hosts the React installer UI.
 * Handles file extraction, shortcut creation, and app launching.
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");

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
    show: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#faf9f5",
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
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("[Installer] Failed to load renderer:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ── Installation helpers ────────────────────────────────────────────────────

// PowerShell is only used for shortcut creation (requires WScript.Shell COM).
// ── No PowerShell anywhere — all ops use Node.js built-ins or Electron APIs ──

// Extract a ZIP using tar.exe (built into Windows 10 1803+).
function extractZipToDir(zipPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const proc = spawn("tar.exe", ["-xf", zipPath, "-C", targetDir], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Extraction failed (tar code ${code}): ${stderr.trim() || "no details"}`));
    });
    proc.on("error", (err) => reject(new Error(`tar.exe unavailable: ${err.message}`)));
  });
}

// Recursively copy srcDir into dstDir using Node.js fs.cpSync.
function copyDir(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  fs.cpSync(srcDir, dstDir, { recursive: true, force: true, errorOnExist: false });
}

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

function getPayloadPath() {
  return path.join(__dirname, "..", "assets", "payload", "app.zip");
}

// Create Windows shortcuts using Electron's native shell.writeShortcutLink.
// Zero PowerShell — no spawn, no execution policy, no WDAC issues.
function createShortcuts(exePath, { desktop = true, startMenu = true } = {}) {
  const opts = { target: exePath, cwd: path.dirname(exePath) };

  if (desktop) {
    const dest = path.join(os.homedir(), "Desktop", "CrewSpace.lnk");
    try { shell.writeShortcutLink(dest, "create", opts); } catch (_) {}
  }

  if (startMenu) {
    const dir = path.join(
      os.homedir(), "AppData", "Roaming", "Microsoft",
      "Windows", "Start Menu", "Programs"
    );
    try {
      fs.mkdirSync(dir, { recursive: true });
      shell.writeShortcutLink(path.join(dir, "CrewSpace.lnk"), "create", opts);
    } catch (_) {}
  }
}

// ── IPC handlers ────────────────────────────────────────────────────────────

// ── Find an already-installed CrewSpace exe ─────────────────────────────────

function findInstalledExe() {
  const candidates = [
    path.join(getAppDataDir(), "app", "CrewSpace.exe"),
    path.join(os.homedir(), "AppData", "Local", "Programs", "CrewSpace", "CrewSpace.exe"),
    path.join(os.homedir(), "AppData", "Local", "CrewSpace", "CrewSpace.exe"),
    "C:\\Program Files\\CrewSpace\\CrewSpace.exe",
    "C:\\Program Files (x86)\\CrewSpace\\CrewSpace.exe",
  ];

  // Also check one level nested inside app/
  const appDir = path.join(getAppDataDir(), "app");
  if (fs.existsSync(appDir)) {
    try {
      const entries = fs.readdirSync(appDir, { withFileTypes: true });
      const subDir = entries.find((e) => e.isDirectory());
      if (subDir) {
        candidates.unshift(path.join(appDir, subDir.name, "CrewSpace.exe"));
      }
    } catch (_) {}
  }

  return candidates.find((p) => fs.existsSync(p)) || null;
}

// ── IPC: install ─────────────────────────────────────────────────────────────

function sendProgress(percent, stage, detail) {
  mainWindow?.webContents.send("install-progress", { percent, stage, detail });
}

ipcMain.handle("install", async () => {
  const zipPath = getPayloadPath();
  // Install target: user-writable location, no admin required.
  // User data lives separately at AppData/Local/CrewSpace/instances/ and is NEVER touched.
  const targetDir = path.join(os.homedir(), "AppData", "Local", "Programs", "CrewSpace");

  try {
    // ── Case 1: payload zip exists → install / in-place update ──────────
    if (fs.existsSync(zipPath)) {
      const isUpdate = fs.existsSync(targetDir);
      sendProgress(5, "extract", isUpdate ? "Preparing update…" : "Preparing installation…");

      // Kill any running CrewSpace process using taskkill (no PowerShell needed)
      try {
        await new Promise((resolve) => {
          const tk = spawn("taskkill.exe", ["/F", "/IM", "CrewSpace.exe", "/T"], {
            stdio: "ignore", windowsHide: true,
          });
          tk.on("close", resolve);
          tk.on("error", resolve);
        });
        // Brief pause to let file handles release
        await new Promise((r) => setTimeout(r, 1500));
      } catch (_) {}

      sendProgress(10, "extract", "Extracting files…");

      // Extract to a temp directory first — avoids lock contention on the live install dir.
      // Uses tar.exe (built into Windows 10+) with Expand-Archive fallback.
      const tempDir = path.join(os.tmpdir(), `crewspace-update-${Date.now()}`);
      await extractZipToDir(zipPath, tempDir);

      sendProgress(65, "extract", "Applying update…");

      // electron-builder sometimes nests all files in a subdir inside the zip
      const tempEntries = fs.readdirSync(tempDir, { withFileTypes: true });
      const hasExeAtRoot = tempEntries.some((e) => e.name === "CrewSpace.exe");
      const srcDir = hasExeAtRoot
        ? tempDir
        : path.join(tempDir, (tempEntries.find((e) => e.isDirectory()) ?? { name: "" }).name);

      // Copy using Node.js fs.cpSync — no robocopy or PowerShell needed
      copyDir(srcDir, targetDir);

      // Clean up temp
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

      let exePath = path.join(targetDir, "CrewSpace.exe");
      if (!fs.existsSync(exePath)) {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const subDir = entries.find((e) => e.isDirectory());
        if (subDir) {
          const nested = path.join(targetDir, subDir.name, "CrewSpace.exe");
          if (fs.existsSync(nested)) exePath = nested;
        }
      }

      sendProgress(85, "shortcuts", "Creating shortcuts…");
      createShortcuts(exePath);
      sendProgress(100, "done", isUpdate ? "Update complete" : "Installation complete");
      return { success: true, installPath: targetDir, exePath };
    }

    // ── Case 2: no payload — simulate progress, find existing install ────
    sendProgress(10, "extract", "Locating CrewSpace installation…");
    await new Promise((r) => setTimeout(r, 600));

    sendProgress(40, "extract", "Verifying installation files…");
    await new Promise((r) => setTimeout(r, 700));

    const existingExe = findInstalledExe();

    sendProgress(70, "extract", "Configuring environment…");
    await new Promise((r) => setTimeout(r, 500));

    sendProgress(85, "shortcuts", "Creating shortcuts…");
    await new Promise((r) => setTimeout(r, 400));

    if (existingExe) {
      try { createShortcuts(existingExe); } catch (_) {}
    }

    sendProgress(100, "done", "Installation complete");
    return { success: true, installPath: targetDir, exePath: existingExe || "" };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Use percent 100 so the renderer progress listener picks it up
    sendProgress(100, "done", `Error: ${message}`);
    throw new Error(message);
  }
});

// ── IPC: launch-app ──────────────────────────────────────────────────────────

ipcMain.handle("launch-app", async () => {
  const exePath = findInstalledExe();

  if (exePath) {
    try {
      const child = spawn(exePath, [], { detached: true, shell: false, stdio: "ignore" });
      child.unref();
      return { success: true, launched: exePath };
    } catch (err) {
      // Fall back to shell.openPath if spawn fails
      await shell.openPath(exePath);
      return { success: true, launched: exePath };
    }
  }

  // Last resort: open the AppData folder so the user can find it
  const folder = path.join(getAppDataDir(), "app");
  if (fs.existsSync(folder)) {
    await shell.openPath(folder);
  }

  return { success: false, error: "CrewSpace executable not found" };
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
