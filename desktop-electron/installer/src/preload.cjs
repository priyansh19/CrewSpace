const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("installerAPI", {
  // Installation
  install: () => ipcRenderer.invoke("install"),
  onProgress: (cb) => ipcRenderer.on("install-progress", (_e, data) => cb(data)),
  offProgress: () => ipcRenderer.removeAllListeners("install-progress"),

  // App lifecycle
  launchApp: () => ipcRenderer.invoke("launch-app"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openInstallFolder: () => ipcRenderer.invoke("open-install-folder"),

  // Window controls
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
});
