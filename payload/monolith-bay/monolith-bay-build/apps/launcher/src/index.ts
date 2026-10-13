// Desktop launcher / updater entry point
// Handles version checks, update downloads, integrity verification, and game launch.

export interface LauncherState {
  installedVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadProgress: number;
}

export async function checkForUpdates(currentVersion: string): Promise<LauncherState> {
  // Placeholder: query release manifest endpoint
  return {
    installedVersion: currentVersion,
    latestVersion: currentVersion,
    updateAvailable: false,
    downloadProgress: 0,
  };
}

export async function downloadUpdate(
  _url: string,
  _onProgress: (pct: number) => void,
): Promise<void> {
  // Placeholder: download and verify update against checksums.sha256
}

export async function verifyIntegrity(_checksumsPath: string): Promise<boolean> {
  // Placeholder: verify all files against release manifest checksums
  return true;
}
