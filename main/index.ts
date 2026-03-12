import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { app, BrowserWindow, Menu } from 'electron';
import * as fs from 'fs';
import { registerIpcHandlers } from './ipc';
import { registerTerminalHandlers, killAllTerminals } from './terminal';
import { registerBuiltInConnectors } from '@flovia/connectors';
import { registerConnectorIpcHandlers } from './connectorIpc';
import { killAllMcpServers } from './mcpServers';

// Check if we should use dev server or built files
// Use built files if they exist and we're not running with VITE_DEV_SERVER env
const rendererDistPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
const useDevServer = process.env.VITE_DEV_SERVER === 'true' || 
  (!app.isPackaged && !fs.existsSync(rendererDistPath));

let mainWindow: BrowserWindow | null = null;



function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (useDevServer) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send('toggle-terminal');
            }
          },
        },
        {
          label: 'Agent Prompts',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send('open-prompts');
            }
          },
        },
        {
          label: 'AI Debug',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            // Open debug window (it's a separate window, not a renderer event)
            import('./debugWindow').then(({ openDebugWindow }) => {
              openDebugWindow();
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Agents',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send('open-agents');
            }
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About flovia',
          click: () => { /* placeholder */ },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Bootstrap connector plugin system
  registerBuiltInConnectors();

  createWindow();
  registerIpcHandlers(() => mainWindow);
  registerTerminalHandlers(() => mainWindow);
  registerConnectorIpcHandlers();
  buildMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAllTerminals();
  killAllMcpServers();
  if (process.platform !== 'darwin') app.quit();
});
