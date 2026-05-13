const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Server / Health
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  getLanServerUrl: () => ipcRenderer.invoke("get-lan-server-url"),
  checkServerHealth: () => ipcRenderer.invoke("check-server-health"),

  // Config / Auth
  hasAuthConfig: () => ipcRenderer.invoke("has-auth-config"),
  saveAuthConfig: (auth) => ipcRenderer.invoke("save-auth-config", auth),
  saveThemePreference: (theme) => ipcRenderer.invoke("save-theme-preference", theme),
  getThemePreference: () => ipcRenderer.invoke("get-theme-preference"),
  markFirstRunComplete: () => ipcRenderer.invoke("mark-first-run-complete"),
  completeOnboarding: (payload) => ipcRenderer.invoke("complete-onboarding", payload),

  // Secure API request channel (main process attaches auth headers)
  apiRequest: (request) => ipcRenderer.invoke("api-request", request),

  // Auth token management
  getAgentToken: () => ipcRenderer.invoke("get-agent-token"),
  setAgentToken: (token) => ipcRenderer.invoke("set-agent-token", token),
  clearAgentToken: () => ipcRenderer.invoke("clear-agent-token"),
  getBoardSessionToken: () => ipcRenderer.invoke("get-board-session-token"),
  setBoardSessionToken: (token) => ipcRenderer.invoke("set-board-session-token", token),
  clearBoardSessionToken: () => ipcRenderer.invoke("clear-board-session-token"),

  // Server Events
  onServerCrashed: (callback) => ipcRenderer.on("server-crashed", (_event, code) => callback(code)),
  onServerError: (callback) => ipcRenderer.on("server-error", (_event, message) => callback(message)),

  // Window Control
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  isWindowMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onWindowMaximizedChanged: (callback) => ipcRenderer.on("window-maximized-changed", (_event, value) => callback(value)),

  // External Links
  openExternal: (url) => ipcRenderer.send("open-external", url),

  // App Lifecycle
  quitApp: () => ipcRenderer.send("quit-app"),

  // Server Management
  restartServerWithAuth: () => ipcRenderer.invoke("restart-server-with-auth"),

  // GitHub Auth
  getGitHubAuthConfig: () => ipcRenderer.invoke("get-github-auth-config"),

  // Dev / Renderer URL
  isDev: () => ipcRenderer.invoke("is-dev"),
  getRendererUrl: () => ipcRenderer.invoke("get-renderer-url"),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on("update-progress", (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on("update-downloaded", (_event, info) => callback(info)),
});
