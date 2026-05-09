const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  checkServerHealth: () => ipcRenderer.invoke("check-server-health"),
  openDataDir: () => ipcRenderer.invoke("open-data-dir"),
});
