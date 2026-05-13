/**
 * Pure utility helpers extracted from main.js — testable without Electron.
 */

const net = require("net");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_PORT = 3150;
const SERVER_BIND_HOST = "0.0.0.0";

function getAppDataDir() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace");
}

function getServerEntryPath(isDev, resourcesPath) {
  if (isDev) {
    return path.join(__dirname, "..", "..", "server", "dist", "index.js");
  }
  return path.join(resourcesPath, "server", "dist", "index.js");
}

function getServerCwd(isDev, resourcesPath) {
  if (isDev) {
    return path.join(__dirname, "..", "..", "server");
  }
  return path.join(resourcesPath, "server");
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

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

function extractPortFromUrl(url) {
  if (!url) return SERVER_PORT;
  try {
    return Number(new URL(url).port) || SERVER_PORT;
  } catch {
    const parts = url.split(":");
    const last = parts.pop();
    const parsed = Number(last);
    return isNaN(parsed) ? SERVER_PORT : parsed;
  }
}

module.exports = {
  getAppDataDir,
  getServerEntryPath,
  getServerCwd,
  getLanIp,
  findFreePort,
  extractPortFromUrl,
};
