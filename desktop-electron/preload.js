const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  getLanServerUrl: () => ipcRenderer.invoke("get-lan-server-url"),
  checkServerHealth: () => ipcRenderer.invoke("check-server-health"),
  openDataDir: () => ipcRenderer.invoke("open-data-dir"),
  onServerCrashed: (callback) => ipcRenderer.on("server-crashed", (_event, code) => callback(code)),
  onServerError: (callback) => ipcRenderer.on("server-error", (_event, message) => callback(message)),
  quitApp: () => ipcRenderer.send("quit-app"),
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  isWindowMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onWindowMaximizedChanged: (callback) => ipcRenderer.on("window-maximized-changed", (_event, value) => callback(value)),
});
