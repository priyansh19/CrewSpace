import { useState, useCallback } from "react";

export interface InstallProgress {
  percent: number;
  stage: "extract" | "shortcuts" | "finalize" | "done";
  detail?: string;
}

export function useInstaller() {
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startInstall = useCallback(async () => {
    setIsInstalling(true);
    setError(null);

    try {
      const result = await window.installerAPI.install();
      setIsInstalling(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Installation failed";
      setError(message);
      setIsInstalling(false);
      throw err;
    }
  }, []);

  return { isInstalling, error, startInstall };
}
