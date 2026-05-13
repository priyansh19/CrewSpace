/**
 * CrewSpace Desktop — Electron main process
 *
 * Spawns the Node.js server as a child process, creates the native window,
 * and manages the application lifecycle.
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, screen, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");
const { readConfig, writeConfig, hasConfig, isFirstRunComplete, markFirstRunComplete, saveThemePreference, getThemePreference, saveAuthConfig, getAuthConfig, authConfigToEnv, saveAgentToken, getAgentToken, clearAgentToken, saveBoardSessionToken, getBoardSessionToken, clearBoardSessionToken } = require("./desktop-config");

// ── Config ──────────────────────────────────────────────────────────
const SERVER_PORT = 3150;
const SERVER_BIND_HOST = "0.0.0.0"; // Listen on all interfaces for LAN access
const SERVER_LOCAL_HOST = "127.0.0.1"; // Electron window connects locally
const HEALTH_MAX_RETRIES = 120;
const HEALTH_INTERVAL_MS = 500;

// ── External Navigation Allowlist ───────────────────────────────────
// ── Paths ───────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function getServerEntryPath() {
  if (isDev) {
    return path.join(__dirname, "..", "server", "dist", "index.js");
  }
  return path.join(process.resourcesPath, "server", "dist", "index.js");
}

function getServerCwd() {
  if (isDev) {
    return path.join(__dirname, "..", "server");
  }
  return path.join(process.resourcesPath, "server");
}

function getServerTsxPath() {
  if (isDev) {
    return path.join(__dirname, "..", "server", "node_modules", ".bin", "tsx.cmd");
  }
  return "";
}

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Prefer IPv4, non-internal, non-loopback
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function isCrewSpaceUrl(url) {
  return serverUrl && url.startsWith(serverUrl);
}

// (GitHub login-check helpers removed — external links now open in system browser)

// ── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverUrl = null; // URL for Electron window (localhost)
let lanServerUrl = null; // URL for other devices on the network
let isQuitting = false;
let normalBounds = null; // Pre-maximize bounds for frameless window restore
let updateAvailable = false;
let updateDownloaded = false;

// ── Auto Updater ────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) {
    console.log("[CrewSpace Desktop] Auto-updater disabled in dev mode.");
    return;
  }

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[CrewSpace Desktop] Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[CrewSpace Desktop] Update available:", info.version);
    updateAvailable = true;
    if (mainWindow) {
      mainWindow.webContents.send("update-available", info);
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[CrewSpace Desktop] No updates available.");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`[CrewSpace Desktop] Download progress: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
      mainWindow.webContents.send("update-progress", progress);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[CrewSpace Desktop] Update downloaded:", info.version);
    updateDownloaded = true;
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded", info);
    }
    // Show a native notification dialog when the update is ready
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `CrewSpace ${info.version} is downloaded and will be installed on quit.`,
        buttons: ["Install Now", "Later"],
        defaultId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("[CrewSpace Desktop] Auto-updater error:", err.message);
  });

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

// IPC handlers for manual update checks
ipcMain.handle("check-for-updates", async () => {
  if (isDev) return { available: false, dev: true };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: result?.updateInfo?.version !== app.getVersion(), version: result?.updateInfo?.version };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle("install-update", () => {
  if (updateDownloaded) {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  }
});

// Dev mode / renderer URL helpers
ipcMain.handle("is-dev", () => isDev);
ipcMain.handle("get-renderer-url", () => {
  if (isDev) {
    return serverUrl || "http://localhost:5173/";
  }
  return "../renderer-dist/index.html";
});

// ── Find free port ──────────────────────────────────────────────────
async function findFreePort(startPort) {
  for (let port = startPort; port <= startPort + 10; port++) {
    try {
      await new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once("error", reject);
        srv.once("listening", () => {
          srv.close(() => resolve(port));
        });
        srv.listen(port, SERVER_BIND_HOST);
      });
      return port;
    } catch {
      // Port in use, try next
    }
  }
  return startPort;
}

// ── Spawn server ────────────────────────────────────────────────────
function spawnServer(port) {
  const dataDir = getAppDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const serverEntry = getServerEntryPath();
  const serverCwd = getServerCwd();

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Server entry not found: ${serverEntry}. Run 'pnpm --filter @crewspaceai/server build' first.`);
  }

  const lanIp = getLanIp();
  const env = {
    ...process.env,
    CREWSPACE_DESKTOP_MODE: "1",
    CREWSPACE_HOME: dataDir,
    HOST: SERVER_BIND_HOST,
    PORT: String(port),
    SERVE_UI: "true",
    CREWSPACE_MIGRATION_AUTO_APPLY: "true",
    CREWSPACE_MIGRATION_PROMPT: "never",
    CREWSPACE_OPEN_ON_LISTEN: "false",
    CREWSPACE_DB_BACKUP_INTERVAL_MINUTES: "10",
    CREWSPACE_DB_BACKUP_RETENTION_COUNT: "1",
    ...(lanIp ? { CREWSPACE_ALLOWED_HOSTNAMES: lanIp } : {}),
    ...authConfigToEnv(getAuthConfig()),
  };

  let execPath;
  let args;
  if (isDev) {
    const tsxPath = getServerTsxPath();
    const useTsx = fs.existsSync(tsxPath);
    execPath = useTsx ? tsxPath : process.execPath;
    args = useTsx ? [serverEntry] : [serverEntry];
    console.log("[CrewSpace Desktop] Using tsx:", useTsx);
  } else {
    // Production: use bundled Node.js to run the prepared server
    execPath = process.execPath;
    args = [serverEntry];
    // Electron executable acts as Node.js when this env var is set
    env.ELECTRON_RUN_AS_NODE = "1";
    console.log("[CrewSpace Desktop] Using bundled server (node + prepared server)");
  }

  console.log("[CrewSpace Desktop] Spawning server:", serverEntry);
  console.log("[CrewSpace Desktop] Data directory:", dataDir);
  console.log("[CrewSpace Desktop] Port:", port);
  if (lanIp) {
    console.log(`[CrewSpace Desktop] LAN IP: ${lanIp} — other devices can connect via http://${lanIp}:${port}`);
  }

  const isCmd = path.extname(execPath).toLowerCase() === ".cmd";
  const proc = spawn(execPath, args, {
    cwd: serverCwd,
    env,
    stdio: "pipe",
    windowsHide: true,
    shell: isCmd,
  });

  proc.stdout.on("data", (data) => {
    try {
      console.log("[server]", data.toString().trimEnd());
    } catch {
      /* Ignore EPIPE from closed console streams during shutdown */
    }
  });

  proc.stderr.on("data", (data) => {
    try {
      console.error("[server]", data.toString().trimEnd());
    } catch {
      /* Ignore EPIPE from closed console streams during shutdown */
    }
  });

  proc.stdout.on("error", () => {
    /* Ignore stdout stream errors (e.g. EPIPE on shutdown) */
  });

  proc.stderr.on("error", () => {
    /* Ignore stderr stream errors (e.g. EPIPE on shutdown) */
  });

  proc.on("close", (code) => {
    console.log(`[CrewSpace Desktop] Server exited with code ${code}`);
    if (!isQuitting && !isRestarting && mainWindow) {
      mainWindow.webContents.send("server-crashed", code);
    }
  });

  proc.on("error", (err) => {
    console.error("[CrewSpace Desktop] Server spawn error:", err);
    if (mainWindow) {
      mainWindow.webContents.send("server-error", err.message);
    }
  });

  return proc;
}

// ── Kill server ─────────────────────────────────────────────────────
let isRestarting = false;

function killServer() {
  if (!serverProcess) return;
  console.log("[CrewSpace Desktop] Killing server...");
  serverProcess.kill("SIGTERM");
  const pid = serverProcess.pid;
  // Force kill after 5s if graceful shutdown fails
  setTimeout(() => {
    try {
      process.kill(pid, 0); // Check if still alive
      console.log("[CrewSpace Desktop] Force killing server...");
      process.kill(pid, "SIGKILL");
    } catch {
      // Already dead
    }
  }, 5000);
}

async function waitForServerDeath(timeoutMs = 10000) {
  if (!serverProcess) return true;
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (!serverProcess || serverProcess.killed || (Date.now() - start > timeoutMs)) {
        resolve(true);
        return;
      }
      try {
        process.kill(serverProcess.pid, 0);
        setTimeout(check, 200);
      } catch {
        resolve(true);
      }
    };
    check();
  });
}

// ── Backup restore ──────────────────────────────────────────────────
function getBackupDir() {
  return path.join(getAppDataDir(), "instances", "default", "data", "backups");
}

function findLatestBackup() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return null;
  const files = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".sql") && f.startsWith("crewspace-"))
    .map((f) => ({ name: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files.length > 0 ? files[0] : null;
}

function writeRestoreSentinel(backupFilename) {
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, "RESTORE_ON_NEXT_BOOT"), backupFilename, "utf-8");
  console.log(`[CrewSpace Desktop] Restore sentinel written for: ${backupFilename}`);
}

function extractPortFromUrl(url) {
  if (!url) return SERVER_PORT;
  try {
    return Number(new URL(url).port) || SERVER_PORT;
  } catch {
    const parts = url.split(":");
    const last = parts.pop();
    const port = Number(last);
    return Number.isNaN(port) ? SERVER_PORT : port;
  }
}

async function respawnServerWithRestore() {
  isRestarting = true;
  try {
    killServer();
    await waitForServerDeath();
    serverProcess = null;

    const port = extractPortFromUrl(serverUrl);
    // Spawn fresh server — it will read the sentinel and restore on boot
    serverProcess = spawnServer(port);

    return await waitForServer(port);
  } finally {
    isRestarting = false;
  }
}

// ── Health check ────────────────────────────────────────────────────
async function waitForServer(port) {
  const url = `http://${SERVER_LOCAL_HOST}:${port}/api/health`;
  for (let i = 0; i < HEALTH_MAX_RETRIES; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  return false;
}

// ── Create window ───────────────────────────────────────────────────
function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    frame: false,
  });

  // Remove default menu
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/src/index.html");
  } else {
    const isFirstRun = !isFirstRunComplete();
    const startPage = isFirstRun ? "onboarding.html" : "index.html";
    mainWindow.loadFile(path.join(__dirname, "src", startPage));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // ── Window state management (maximize / unmaximize / fullscreen) ──
  // Track normal bounds continuously so Aero Snap restore works
  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      normalBounds = mainWindow.getBounds();
    }
  });

  // On Windows a frameless window fills the whole screen on maximize,
  // covering the taskbar. Constrain it to the monitor work area.
  mainWindow.on("maximize", () => {
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    mainWindow.setBounds(display.workArea);
    emitMaximizedState();
  });

  mainWindow.on("unmaximize", () => {
    if (normalBounds) {
      mainWindow.setBounds(normalBounds);
      normalBounds = null;
    }
    emitMaximizedState();
  });

  // Fullscreen: hide the custom title bar and remove top padding
  mainWindow.on("enter-full-screen", () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const bar = document.getElementById('crewspace-titlebar');
        if (bar) bar.style.display = 'none';
        const root = document.body.querySelector('div:first-child');
        if (root) {
          root.style.paddingTop = '0px';
          root.style.height = '100%';
        }
        const layout = root?.querySelector('div:first-child');
        if (layout) {
          layout.style.height = '100dvh';
          layout.style.maxHeight = '100dvh';
        }
      })();
    `).catch(() => {});
  });

  mainWindow.on("leave-full-screen", () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const bar = document.getElementById('crewspace-titlebar');
        if (bar) bar.style.display = '';
        const root = document.body.querySelector('div:first-child');
        if (root) {
          root.style.paddingTop = '';
          root.style.height = '';
        }
        const layout = root?.querySelector('div:first-child');
        if (layout) {
          layout.style.height = '';
          layout.style.maxHeight = '';
        }
      })();
    `).catch(() => {});
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Navigation guard: open all external links in the system default browser
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isCrewSpaceUrl(url)) return;
    if (url.startsWith("file://")) return;

    // Any non-CrewSpace URL opens in the user's default browser
    event.preventDefault();
    shell.openExternal(url);
  });

  // Control new-window requests
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isCrewSpaceUrl(url)) {
      mainWindow.loadURL(url);
      return { action: "deny" };
    }
    // Open everything else in the system default browser
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Inject CrewSpace title bar only on CrewSpace UI pages
  function handleNavigation(url) {
    if (isCrewSpaceUrl(url)) {
      injectCrewSpaceTitleBar(mainWindow);
    }
  }

  mainWindow.webContents.on("did-navigate", (_event, url) => {
    handleNavigation(url);
  });

  mainWindow.webContents.on("dom-ready", () => {
    handleNavigation(mainWindow.webContents.getURL());
  });

  return mainWindow;
}

// ── Title bar CSS injection ─────────────────────────────────────────
let injectedTitleBarKey = null;

function injectCrewSpaceTitleBar(win) {
  if (injectedTitleBarKey) {
    try { win.webContents.removeInsertedCSS(injectedTitleBarKey); } catch {}
  }
  const css = [
    "body > div:first-child { padding-top: 32px !important; height: 100% !important; display: flex !important; flex-direction: column !important; box-sizing: border-box !important; }",
    "body > div:first-child > div:first-child { flex: 1 1 auto !important; min-height: 0 !important; height: auto !important; max-height: none !important; }",
    ".crewspace-titlebar { position: fixed; top: 0; left: 0; right: 0; height: 32px; background: hsl(var(--background)); border-bottom: 1px solid hsl(var(--border)); display: flex; align-items: center; justify-content: space-between; padding: 0 0 0 12px; z-index: 99999; -webkit-app-region: drag; user-select: none; box-sizing: border-box; }",
    ".crewspace-titlebar-drag { flex: 1; height: 100%; -webkit-app-region: drag; }",
    ".crewspace-titlebar-btns { display: flex; align-items: center; height: 100%; gap: 0; }",
    ".crewspace-titlebar-btn { width: 46px; height: 100%; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); -webkit-app-region: no-drag; transition: background 120ms, color 120ms; padding: 0; margin: 0; }",
    ".crewspace-titlebar-btn:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }",
    ".crewspace-titlebar-btn.close:hover { background: #dc2626; color: #fff; }",
    ".crewspace-titlebar-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }",
  ].join(" ");
  win.webContents.insertCSS(css).then((key) => {
    injectedTitleBarKey = key;
  }).catch(() => {});

  // Inject the title bar HTML via script
  const js = `
    (function() {
      if (document.getElementById('crewspace-titlebar')) return;
      const bar = document.createElement('div');
      bar.id = 'crewspace-titlebar';
      bar.className = 'crewspace-titlebar';
      bar.innerHTML = '<div class="crewspace-titlebar-drag"></div>' +
        '<div class="crewspace-titlebar-btns">' +
          '<button class="crewspace-titlebar-btn minimize" onclick="window.electronAPI.minimizeWindow()" title="Minimize">' +
            '<svg viewBox="0 0 24 24"><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"></line></svg>' +
          '</button>' +
          '<button class="crewspace-titlebar-btn maximize" onclick="window.electronAPI.maximizeWindow()" title="Maximize">' +
            '<svg viewBox="0 0 24 24"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"></rect></svg>' +
          '</button>' +
          '<button class="crewspace-titlebar-btn close" onclick="window.electronAPI.closeWindow()" title="Close">' +
            '<svg viewBox="0 0 24 24"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg>' +
          '</button>' +
        '</div>';
      document.body.appendChild(bar);
      // Update maximize button icon based on state
      window.electronAPI.onWindowMaximizedChanged((isMax) => {
        const btn = document.querySelector('.crewspace-titlebar-btn.maximize');
        if (!btn) return;
        if (isMax) {
          btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"1.5\" ry=\"1.5\"></rect><path d=\"M4 16V4h12\"></path></svg>';
          btn.title = 'Restore';
        } else {
          btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"></rect></svg>';
          btn.title = 'Maximize';
        }
      });
    })();
  `;
  win.webContents.executeJavaScript(js).catch(() => {});
}

// (injectExternalTitleBar removed — external links now open in system browser)

// ── System tray ─────────────────────────────────────────────────────
function createTray() {
  let trayIcon = null;

  const candidates = [
    path.join(__dirname, "assets", "icon.ico"),
    path.join(__dirname, "src", "favicon.ico"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const img = nativeImage.createFromPath(candidate);
        if (!img.isEmpty()) {
          trayIcon = img;
          break;
        }
      } catch {
        // invalid image, try next
      }
    }
  }

  if (!trayIcon || trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("CrewSpace");

  const updateLabel = updateDownloaded
    ? "Install Update..."
    : updateAvailable
      ? "Downloading Update..."
      : "Check for Updates";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show CrewSpace",
      click: () => {
        createWindow();
      },
    },
    {
      label: "Open Data Directory",
      click: () => {
        shell.openPath(getAppDataDir());
      },
    },
    {
      label: "Copy LAN URL",
      click: () => {
        if (lanServerUrl) {
          const { clipboard } = require("electron");
          clipboard.writeText(lanServerUrl);
        }
      },
    },
    {
      label: updateLabel,
      enabled: !updateAvailable || updateDownloaded,
      click: () => {
        if (updateDownloaded) {
          isQuitting = true;
          autoUpdater.quitAndInstall(false, true);
        } else {
          autoUpdater.checkForUpdatesAndNotify().catch(() => {});
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    createWindow();
  });
}

// ── IPC handlers ────────────────────────────────────────────────────
ipcMain.handle("get-server-url", () => serverUrl);

ipcMain.handle("get-lan-server-url", () => lanServerUrl);

ipcMain.handle("check-server-health", async () => {
  if (!serverUrl) return false;
  try {
    const res = await fetch(`${serverUrl}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
});

ipcMain.handle("open-data-dir", () => {
  shell.openPath(getAppDataDir());
});

ipcMain.handle("has-auth-config", () => {
  return hasConfig();
});

ipcMain.handle("save-auth-config", (_event, auth) => {
  try {
    saveAuthConfig(auth);
    return { success: true };
  } catch (err) {
    console.error("[CrewSpace Desktop] Failed to save auth config:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("save-theme-preference", (_event, theme) => {
  try {
    saveThemePreference(theme);
    return { success: true };
  } catch (err) {
    console.error("[CrewSpace Desktop] Failed to save theme:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-theme-preference", () => {
  try {
    return getThemePreference();
  } catch (err) {
    console.error("[CrewSpace Desktop] Failed to get theme:", err);
    return "system";
  }
});

ipcMain.handle("mark-first-run-complete", () => {
  try {
    markFirstRunComplete();
    return { success: true };
  } catch (err) {
    console.error("[CrewSpace Desktop] Failed to mark first run:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("complete-onboarding", async (_event, payload) => {
  try {
    const { theme, auth } = payload || {};

    // Save preferences
    if (theme) saveThemePreference(theme);
    if (auth) saveAuthConfig(auth);
    markFirstRunComplete();

    // Inject updated auth env into the running server
    const newEnv = authConfigToEnv(getAuthConfig());
    if (Object.keys(newEnv).length > 0) {
      console.log("[CrewSpace Desktop] Auth config saved. New credentials will be active on next server start.");
    }

    // Check for latest backup
    const latestBackup = findLatestBackup();
    let restored = false;

    if (latestBackup) {
      console.log(`[CrewSpace Desktop] Found backup: ${latestBackup.name}`);
      writeRestoreSentinel(latestBackup.name);
      const ok = await respawnServerWithRestore();
      if (!ok) {
        console.error("[CrewSpace Desktop] Server failed to come back up after restore.");
        return { success: false, error: "Server restart failed after restore", serverUrl: null, restored: false };
      }
      restored = true;
    }

    return { success: true, serverUrl, restored };
  } catch (err) {
    console.error("[CrewSpace Desktop] complete-onboarding failed:", err);
    return { success: false, error: err.message, serverUrl: null, restored: false };
  }
});

ipcMain.on("open-external", (_event, url) => {
  shell.openExternal(url);
});

ipcMain.on("quit-app", () => {
  isQuitting = true;
  app.quit();
});

// ── GitHub Auth IPC handlers ────────────────────────────────────────

/** Read current GitHub auth from desktop-config. */
ipcMain.handle("get-github-auth-config", () => {
  const auth = getAuthConfig();
  return auth?.github || null;
});

/** Restart the server with the latest auth env vars. */
ipcMain.handle("restart-server-with-auth", async () => {
  isRestarting = true;
  try {
    killServer();
    await waitForServerDeath();
    serverProcess = null;
    const port = extractPortFromUrl(serverUrl);
    serverProcess = spawnServer(port);
    const ok = await waitForServer(port);
    return { success: ok, serverUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    isRestarting = false;
  }
});

// ── Secure API request IPC handler ──────────────────────────────────
// The main process acts as a trusted proxy: it injects stored auth tokens
// and makes the actual HTTP request so sensitive tokens never live in the
// renderer process.
ipcMain.handle("api-request", async (_event, request) => {
  if (!serverUrl) {
    return { ok: false, status: 0, error: { message: "Server not available" } };
  }

  const { method = "GET", path, body, headers: extraHeaders } = request || {};
  const url = `${serverUrl}/api${path}`;

  const headers = new Headers(extraHeaders);
  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Inject auth tokens from secure storage
  const agentToken = getAgentToken();
  const boardToken = getBoardSessionToken();
  if (agentToken) {
    headers.set("Authorization", `Bearer ${agentToken}`);
  } else if (boardToken) {
    headers.set("X-Board-Session", boardToken);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      return {
        ok: false,
        status: res.status,
        error: {
          message: errorBody?.error || `Request failed: ${res.status}`,
          status: res.status,
          body: errorBody,
        },
      };
    }

    if (res.status === 204) {
      return { ok: true, status: 204 };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
});

// ── Auth token IPC handlers ─────────────────────────────────────────
ipcMain.handle("get-agent-token", () => getAgentToken());
ipcMain.handle("set-agent-token", (_event, token) => saveAgentToken(token));
ipcMain.handle("clear-agent-token", () => clearAgentToken());
ipcMain.handle("get-board-session-token", () => getBoardSessionToken());
ipcMain.handle("set-board-session-token", (_event, token) => saveBoardSessionToken(token));
ipcMain.handle("clear-board-session-token", () => clearBoardSessionToken());

// Window control IPC handlers
ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    normalBounds = mainWindow.getBounds();
    mainWindow.maximize();
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Emit maximize state changes to renderer
function emitMaximizedState() {
  if (mainWindow) {
    mainWindow.webContents.send("window-maximized-changed", mainWindow.isMaximized());
  }
}

// ── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  const port = await findFreePort(SERVER_PORT);
  serverUrl = `http://${SERVER_LOCAL_HOST}:${port}`;
  const lanIp = getLanIp();
  lanServerUrl = lanIp ? `http://${lanIp}:${port}` : null;

  serverProcess = spawnServer(port);

  createWindow();
  createTray();
  setupAutoUpdater();

  app.on("activate", () => {
    createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  killServer();
});

app.on("will-quit", () => {
  killServer();
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[CrewSpace Desktop] Another instance is already running. Quitting.");
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
