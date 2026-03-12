/**
 * Shared data directory resolver.
 *
 * In Electron, returns `app.getPath('userData')`.
 * In plain Node.js (server / CLI), returns a platform-appropriate path
 * that mirrors where Electron would store data, so that configuration
 * is shared between desktop, CLI, and server modes.
 */

import * as path from 'path';
import * as os from 'os';

let _dataDir: string | null = null;

/**
 * Returns the user-data directory (equivalent to Electron's `app.getPath('userData')`).
 *
 * Resolution order:
 *  1. `FLOVIA_DATA_DIR` environment variable (explicit override).
 *  2. Electron `app.getPath('userData')` (if running inside Electron).
 *  3. Platform default matching Electron's convention:
 *     - macOS:   ~/Library/Application Support/flovia
 *     - Linux:   ~/.config/flovia
 *     - Windows: %APPDATA%/flovia
 */
export function getUserDataDir(): string {
  if (_dataDir) return _dataDir;

  // 1. Env override
  if (process.env.FLOVIA_DATA_DIR) {
    _dataDir = process.env.FLOVIA_DATA_DIR;
    return _dataDir!;
  }

  // 2. Try Electron
  try {
    // Dynamic require so this module doesn't hard-depend on electron
    const electron = require('electron');
    if (electron?.app?.getPath) {
      _dataDir = electron.app.getPath('userData');
      return _dataDir!;
    }
  } catch {
    // Not in Electron — fall through
  }

  // 3. Platform default
  const platform = os.platform();
  const appName = 'flovia';

  if (platform === 'darwin') {
    _dataDir = path.join(os.homedir(), 'Library', 'Application Support', appName);
  } else if (platform === 'win32') {
    _dataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  } else {
    // Linux / other
    _dataDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName);
  }

  return _dataDir!;
}
