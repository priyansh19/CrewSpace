/**
 * Type declarations for the Electron preload API exposed via contextBridge.
 */

export interface ApiRequestInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { message: string; status?: number; body?: unknown };
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface ElectronAPI {
  // Server / Health
  getServerUrl(): Promise<string>;
  getLanServerUrl(): Promise<string | null>;
  checkServerHealth(): Promise<boolean>;

  // Config / Auth
  hasAuthConfig(): Promise<boolean>;
  saveAuthConfig(auth: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;
  saveThemePreference(theme: string): Promise<{ success: boolean; error?: string }>;
  getThemePreference(): Promise<string>;
  markFirstRunComplete(): Promise<{ success: boolean; error?: string }>;
  completeOnboarding(payload?: { theme?: string; auth?: Record<string, unknown> }): Promise<{
    success: boolean;
    serverUrl?: string | null;
    restored?: boolean;
    error?: string;
  }>;

  // Secure API request channel
  apiRequest<T = unknown>(request: ApiRequestInit): Promise<ApiResponse<T>>;

  // Auth token management
  getAgentToken(): Promise<string | null>;
  setAgentToken(token: string): Promise<void>;
  clearAgentToken(): Promise<void>;
  getBoardSessionToken(): Promise<string | null>;
  setBoardSessionToken(token: string): Promise<void>;
  clearBoardSessionToken(): Promise<void>;

  // Server events
  onServerCrashed(callback: (code: number | null) => void): void;
  onServerError(callback: (message: string) => void): void;

  // Window control
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
  isWindowMaximized(): Promise<boolean>;
  onWindowMaximizedChanged(callback: (isMaximized: boolean) => void): void;

  // External links
  openExternal(url: string): void;

  // App lifecycle
  quitApp(): void;

  // Server management
  restartServerWithAuth(): Promise<{ success: boolean; serverUrl?: string; error?: string }>;

  // GitHub auth
  getGitHubAuthConfig(): Promise<Record<string, unknown> | null>;

  // Dev / Renderer URL
  isDev(): Promise<boolean>;
  getRendererUrl(): Promise<string>;

  // Auto-updater
  checkForUpdates(): Promise<{ available: boolean; version?: string; error?: string; dev?: boolean }>;
  installUpdate(): void;
  onUpdateAvailable(callback: (info: UpdateInfo) => void): void;
  onUpdateProgress(callback: (progress: UpdateProgress) => void): void;
  onUpdateDownloaded(callback: (info: UpdateInfo) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
