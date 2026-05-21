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

// Persistent file log under %TEMP%\\crewspace-installer.log so failures are diagnosable
// even when the renderer never opens DevTools. Best-effort - never crashes the app.
const logFile = path.join(os.tmpdir(), "crewspace-installer.log");
function flog(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}
flog(`installer start, pid=${process.pid}, app.isPackaged=${app.isPackaged}, __dirname=${__dirname}`);

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

  // Force the window to the foreground in case another app stole focus
  // (some users reported the wizard opening behind other windows).
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
    mainWindow.setAlwaysOnTop(true);
    setTimeout(() => mainWindow?.setAlwaysOnTop(false), 1500);
  });

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
  // Probe several candidate locations - portable Electron sometimes puts resources
  // in slightly different paths between dev, asar, and portable extraction.
  const candidates = [
    path.join(__dirname, "..", "assets", "payload", "app.zip"),
    path.join(process.resourcesPath || "", "app", "assets", "payload", "app.zip"),
    path.join(process.resourcesPath || "", "assets", "payload", "app.zip"),
    path.join(app.getAppPath(), "assets", "payload", "app.zip"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      flog(`payload found at ${c}`);
      return c;
    }
  }
  flog(`payload NOT FOUND. Probed: ${candidates.join(" | ")}`);
  return candidates[0]; // returned for existing existsSync caller; will be false
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

      // Kill any running CrewSpace process using taskkill (no PowerShell needed).
      // We then verify with tasklist — taskkill silently fails to terminate
      // processes running at a higher integrity level (e.g. CrewSpace launched
      // as Administrator) and that leaves file locks that break the install.
      try {
        await new Promise((resolve) => {
          const tk = spawn("taskkill.exe", ["/F", "/IM", "CrewSpace.exe", "/T"], {
            stdio: "ignore", windowsHide: true,
          });
          tk.on("close", resolve);
          tk.on("error", resolve);
        });
        await new Promise((r) => setTimeout(r, 1500));
      } catch (_) {}

      const stillRunning = await new Promise((resolve) => {
        const tl = spawn("tasklist.exe", ["/FI", "IMAGENAME eq CrewSpace.exe", "/NH"], {
          stdio: ["ignore", "pipe", "ignore"], windowsHide: true,
        });
        let out = "";
        tl.stdout.on("data", (d) => { out += d.toString(); });
        tl.on("close", () => resolve(out.toLowerCase().includes("crewspace.exe")));
        tl.on("error", () => resolve(false));
      });
      if (stillRunning) {
        throw new Error(
          "CrewSpace is still running and could not be closed automatically. " +
          "This usually means CrewSpace is running with Administrator privileges. " +
          "Please open Task Manager as Administrator, end every CrewSpace.exe task, " +
          "and run the installer again."
        );
      }

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

    // ── Case 2: no payload — this means the installer was packaged
    // incorrectly. Fail loudly so the user knows nothing was installed,
    // rather than silently launching a stale binary.
    const zipPath2 = getPayloadPath();
    flog(`install handler: no payload at ${zipPath2}`);
    throw new Error(
      "Installer payload (app.zip) is missing from this build. " +
      "Nothing was installed. Please download the latest installer from " +
      "https://github.com/priyansh19/CrewSpace/releases and try again."
    );

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

// First, refuse to start if another CrewSpace Setup.exe is already running on the
// machine (covers the race where two wrapper EXEs extract simultaneously to different
// temp dirs and both reach the `requestSingleInstanceLock` call below).
try {
  const out = require("child_process").execSync(
    `tasklist /FI "IMAGENAME eq CrewSpace Setup.exe" /NH`,
    { stdio: ["ignore", "pipe", "ignore"] }
  ).toString();
  const myPid = process.pid;
  // Count "CrewSpace Setup.exe" entries that aren't us.
  const matches = (out.match(/CrewSpace Setup\.exe\s+(\d+)/g) || [])
    .map((m) => parseInt(m.split(/\s+/)[1], 10))
    .filter((p) => p && p !== myPid);
  if (matches.length > 0) {
    flog(`refusing to start: existing CrewSpace Setup.exe PIDs ${matches.join(",")} already running`);
    app.quit();
    process.exit(0);
  }
} catch (_) {}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  flog("requestSingleInstanceLock denied - another instance already running");
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
