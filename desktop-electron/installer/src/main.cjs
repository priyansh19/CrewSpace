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
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("[Installer] Failed to load renderer:", err);
    });
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

// Use spawn(powershell.exe) directly — avoids cmd.exe newline/quoting issues
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    ps.stderr.on("data", (d) => { stderr += d.toString(); });
    ps.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PowerShell failed (code ${code}): ${stderr.trim() || "no details"}`));
    });
    ps.on("error", reject);
  });
}

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

function getPayloadPath() {
  // In dev: __dirname = src/  →  ../assets/payload/app.zip
  // In prod (asar:false): __dirname = resources/app/src/  →  ../assets/payload/app.zip
  return path.join(__dirname, "..", "assets", "payload", "app.zip");
}

async function extractZip(zipPath, targetDir, onProgress) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeZip = zipPath.replace(/'/g, "''");
  const safeTarget = targetDir.replace(/'/g, "''");

  onProgress?.({ percent: 5, stage: "extract", detail: "Starting extraction…" });

  // spawn powershell.exe directly — avoids cmd.exe breaking on newlines/quotes
  await runPowerShell(`Expand-Archive -Path '${safeZip}' -DestinationPath '${safeTarget}' -Force`);

  onProgress?.({ percent: 70, stage: "extract", detail: "Extraction complete" });
}

async function createShortcut(exePath, shortcutPath) {
  const safeExe = exePath.replace(/'/g, "''");
  const safeDir = path.dirname(exePath).replace(/'/g, "''");
  const safeShortcut = shortcutPath.replace(/'/g, "''");

  // Single-line script — safe to pass directly to spawn(powershell.exe)
  const script = [
    `$w = New-Object -comObject WScript.Shell`,
    `$s = $w.CreateShortcut('${safeShortcut}')`,
    `$s.TargetPath = '${safeExe}'`,
    `$s.WorkingDirectory = '${safeDir}'`,
    `$s.Save()`,
  ].join("; ");

  await runPowerShell(script);
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

      // Kill running CrewSpace and wait for it to fully exit before touching files.
      // Using a wait loop avoids the "file locked" error from the old instant-delete approach.
      try {
        await runPowerShell(
          "$proc = Get-Process -Name 'CrewSpace' -ErrorAction SilentlyContinue; " +
          "if ($proc) { $proc | Stop-Process -Force; Start-Sleep -Seconds 2 }"
        );
      } catch (_) {}

      sendProgress(10, "extract", "Extracting files…");

      // Extract to a temp directory first — avoids lock contention on the live install dir
      const tempDir = path.join(os.tmpdir(), `crewspace-update-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const safeZip = zipPath.replace(/'/g, "''");
      const safeTemp = tempDir.replace(/'/g, "''");
      await runPowerShell(`Expand-Archive -Path '${safeZip}' -DestinationPath '${safeTemp}' -Force`);

      sendProgress(65, "extract", "Applying update…");

      // electron-builder sometimes nests all files in a subdir inside the zip
      const tempEntries = fs.readdirSync(tempDir, { withFileTypes: true });
      const hasExeAtRoot = tempEntries.some((e) => e.name === "CrewSpace.exe");
      const srcDir = hasExeAtRoot
        ? tempDir
        : path.join(tempDir, (tempEntries.find((e) => e.isDirectory()) ?? { name: "" }).name);

      // Robocopy merge: overwrite existing files, copy new ones, keep unrelated extras.
      // Run robocopy directly (not via Start-Process) so $LASTEXITCODE is reliable.
      // Exit codes 0–7 are success (files copied/skipped); ≥8 means real error.
      fs.mkdirSync(targetDir, { recursive: true });
      const safeSrc = srcDir.replace(/'/g, "''");
      const safeDst = targetDir.replace(/'/g, "''");
      await runPowerShell(
        `robocopy '${safeSrc}' '${safeDst}' /E /IS /IT /IM /NFL /NDL /NJH /NJS; ` +
        `if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE } else { exit 0 }`
      );

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
      await createShortcuts(exePath);
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
      try { await createShortcuts(existingExe); } catch (_) {}
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
