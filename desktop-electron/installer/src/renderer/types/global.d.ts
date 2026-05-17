export interface InstallProgress {
  percent: number;
  stage: "extract" | "shortcuts" | "finalize" | "done";
  detail?: string;
}

export interface InstallerAPI {
  install: () => Promise<{ success: boolean; installPath: string }>;
  onProgress: (cb: (progress: InstallProgress) => void) => void;
  offProgress: () => void;
  launchApp: () => Promise<{ success: boolean }>;
  openExternal: (url: string) => Promise<void>;
  openInstallFolder: () => Promise<void>;
  minimizeWindow: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    installerAPI: InstallerAPI;
  }
}

export {};
