/**
 * CrewSpace Desktop — Encrypted desktop config storage
 *
 * Stores auth credentials, theme preference, and first-run state
 * encrypted at rest using a key derived from machine-specific data.
 *
 * MVP security: AES-256-GCM with a key derived from hostname + username.
 * Future: migrate to Windows DPAPI or Credential Manager.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_FILE_NAME = "desktop-config.enc";
const SALT = Buffer.from("crewspace-desktop-config-v1-salt", "utf-8");
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getConfigPath() {
  return path.join(os.homedir(), "AppData", "Local", "CrewSpace", CONFIG_FILE_NAME);
}

function deriveKey() {
  const seed = `${os.hostname()}\0${os.userInfo().username}`;
  return crypto.scryptSync(seed, SALT, KEY_LENGTH);
}

function encrypt(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(ciphertextBase64) {
  const key = deriveKey();
  const data = Buffer.from(ciphertextBase64, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf-8");
}

function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const encrypted = fs.readFileSync(configPath, "utf-8");
    const json = decrypt(encrypted);
    return JSON.parse(json);
  } catch (err) {
    console.error("[desktop-config] Failed to read/decrypt config:", err.message);
    return null;
  }
}

function writeConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const json = JSON.stringify(config, null, 2);
  const encrypted = encrypt(json);
  fs.writeFileSync(configPath, encrypted, "utf-8");
}

function hasConfig() {
  return fs.existsSync(getConfigPath());
}

function isFirstRunComplete() {
  const config = readConfig();
  return config?.firstRunComplete === true;
}

function markFirstRunComplete() {
  const config = readConfig() || {};
  config.firstRunComplete = true;
  writeConfig(config);
}

function saveThemePreference(theme) {
  const config = readConfig() || {};
  config.theme = theme;
  writeConfig(config);
}

function getThemePreference() {
  const config = readConfig();
  return config?.theme || "system";
}

function saveAuthConfig(auth) {
  const config = readConfig() || {};
  // Only overwrite keys that are explicitly provided in the auth object.
  // This prevents github saves from wiping kimi (and vice-versa).
  if (auth.github !== undefined) config.github = auth.github || {};
  if (auth.kimi !== undefined) config.kimi = auth.kimi || {};
  writeConfig(config);
}

function getAuthConfig() {
  const config = readConfig();
  if (!config) return null;
  return {
    github: config.github || {},
    kimi: config.kimi || {},
  };
}

function authConfigToEnv(config) {
  if (!config) return {};
  const env = {};
  const github = config.github || {};

  // PAT mode takes precedence
  if (github.pat) {
    env.GITHUB_PAT = github.pat;
  } else {
    if (github.appId) env.GITHUB_APP_ID = github.appId;
    if (github.privateKey) env.GITHUB_APP_PRIVATE_KEY = github.privateKey;
    if (github.clientId) env.GITHUB_APP_CLIENT_ID = github.clientId;
    if (github.clientSecret) env.GITHUB_APP_CLIENT_SECRET = github.clientSecret;
    if (github.appSlug) env.GITHUB_APP_SLUG = github.appSlug;
  }

  const kimi = config.kimi || {};
  if (kimi.apiKey) env.KIMI_API_KEY = kimi.apiKey;

  return env;
}

// ── Per-agent JWT tokens ─────────────────────────────────────────────

function saveAgentToken(agentId, token) {
  const config = readConfig() || {};
  if (!config.agentTokens) config.agentTokens = {};
  config.agentTokens[agentId] = token;
  writeConfig(config);
}

function getAgentToken(agentId) {
  const config = readConfig();
  return config?.agentTokens?.[agentId] ?? null;
}

function clearAgentToken(agentId) {
  const config = readConfig() || {};
  if (config.agentTokens) {
    delete config.agentTokens[agentId];
    writeConfig(config);
  }
}

// ── Board session tokens ─────────────────────────────────────────────

function saveBoardSessionToken(boardId, token) {
  const config = readConfig() || {};
  if (!config.boardSessionTokens) config.boardSessionTokens = {};
  config.boardSessionTokens[boardId] = token;
  writeConfig(config);
}

function getBoardSessionToken(boardId) {
  const config = readConfig();
  return config?.boardSessionTokens?.[boardId] ?? null;
}

function clearBoardSessionToken(boardId) {
  const config = readConfig() || {};
  if (config.boardSessionTokens) {
    delete config.boardSessionTokens[boardId];
    writeConfig(config);
  }
}

module.exports = {
  readConfig,
  writeConfig,
  hasConfig,
  isFirstRunComplete,
  markFirstRunComplete,
  saveThemePreference,
  getThemePreference,
  saveAuthConfig,
  getAuthConfig,
  authConfigToEnv,
  saveAgentToken,
  getAgentToken,
  clearAgentToken,
  saveBoardSessionToken,
  getBoardSessionToken,
  clearBoardSessionToken,
};
