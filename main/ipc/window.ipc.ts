/**
 * Window IPC handler
 */
import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Check if we should use dev server or built files
const rendererDistPath = path.join(__dirname, '..', '..', '..', 'renderer', 'dist', 'index.html');
const useDevServer = process.env.VITE_DEV_SERVER === 'true' ||
  (!require('electron').app.isPackaged && !fs.existsSync(rendererDistPath));

export function registerWindowIpc(): void {
  ipcMain.handle('new-window', async () => {
    const newWin = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },
      webPreferences: {
        preload: path.join(__dirname, '..', '..', '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (useDevServer) {
      newWin.loadURL('http://localhost:5173');
    } else {
      newWin.loadFile(path.join(__dirname, '..', '..', '..', 'renderer', 'dist', 'index.html'));
    }

    return true;
  });
}
