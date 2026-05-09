/**
 * CrewSpace Desktop — Electron main process
 *
 * Spawns the Node.js server as a child process, creates the native window,
 * and manages the application lifecycle.
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");

// ── Config ──────────────────────────────────────────────────────────
const SERVER_PORT = 3100;
const SERVER_HOST = "127.0.0.1";
const HEALTH_MAX_RETRIES = 120;
const HEALTH_INTERVAL_MS = 500;

// ── Paths ───────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function getServerEntryPath() {
  if (isDev) {
    return path.join(__dirname, "..", "server", "dist", "index.js");
  }
  return path.join(process.resourcesPath, "server", "dist", "index.js");
}

function getServerTsxPath() {
  if (isDev) {
    return path.join(__dirname, "..", "server", "node_modules", ".bin", "tsx.cmd");
  }
  return path.join(process.resourcesPath, "server", "node_modules", ".bin", "tsx.cmd");
}

function getServerCwd() {
  if (isDev) {
    return path.join(__dirname, "..", "server");
  }
  return path.join(process.resourcesPath, "server");
}

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

// ── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverUrl = null;

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
        srv.listen(port, SERVER_HOST);
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

  const env = {
    ...process.env,
    CREWSPACE_DESKTOP_MODE: "1",
    CREWSPACE_HOME: dataDir,
    HOST: SERVER_HOST,
    PORT: String(port),
    SERVE_UI: "true",
    CREWSPACE_MIGRATION_AUTO_APPLY: "true",
    CREWSPACE_MIGRATION_PROMPT: "never",
    CREWSPACE_OPEN_ON_LISTEN: "false",
  };

  const tsxPath = getServerTsxPath();
  const useTsx = fs.existsSync(tsxPath);
  const execPath = useTsx ? tsxPath : process.execPath;
  const args = useTsx ? [serverEntry] : [serverEntry];

  console.log("[CrewSpace Desktop] Spawning server:", serverEntry);
  console.log("[CrewSpace Desktop] Data directory:", dataDir);
  console.log("[CrewSpace Desktop] Port:", port);
  console.log("[CrewSpace Desktop] Using tsx:", useTsx);

  const isCmd = path.extname(execPath).toLowerCase() === ".cmd";
  const proc = spawn(execPath, args, {
    cwd: serverCwd,
    env,
    stdio: "pipe",
    windowsHide: true,
    shell: isCmd,
  });

  proc.stdout.on("data", (data) => {
    console.log("[server]", data.toString().trimEnd());
  });

  proc.stderr.on("data", (data) => {
    console.error("[server]", data.toString().trimEnd());
  });

  proc.on("close", (code) => {
    console.log(`[CrewSpace Desktop] Server exited with code ${code}`);
  });

  proc.on("error", (err) => {
    console.error("[CrewSpace Desktop] Server spawn error:", err);
  });

  return proc;
}

// ── Health check ────────────────────────────────────────────────────
async function waitForServer(port) {
  const url = `http://${SERVER_HOST}:${port}/api/health`;
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
    icon: path.join(__dirname, "assets", "icon.ico"),
    titleBarStyle: "default",
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── System tray ─────────────────────────────────────────────────────
function createTray() {
  const { nativeImage } = require("electron");
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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show CrewSpace",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Open Data Directory",
      click: () => {
        shell.openPath(getAppDataDir());
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── IPC handlers ────────────────────────────────────────────────────
ipcMain.handle("get-server-url", () => serverUrl);

ipcMain.handle("check-server-health", async () => {
  if (!serverUrl) return false;
  try {
    const res = await fetch(`${serverUrl}api/health`, {
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

// ── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  const port = await findFreePort(SERVER_PORT);
  serverUrl = `http://${SERVER_HOST}:${port}/`;

  serverProcess = spawnServer(port);

  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep running in background via tray on Windows
});

app.on("before-quit", () => {
  if (serverProcess) {
    console.log("[CrewSpace Desktop] Killing server...");
    serverProcess.kill("SIGTERM");
    // Force kill after 5s if graceful shutdown fails
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 5000);
  }
});
