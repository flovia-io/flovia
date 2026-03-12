import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface DebugLogEntry {
  id: number;
  timestamp: string;
  model: string;
  baseUrl: string;
  messages: { role: string; content: string }[];
  status: 'pending' | 'success' | 'error' | 'aborted';
  response?: string;
  error?: string;
  durationMs?: number;
}

let debugWindow: BrowserWindow | null = null;
let debugLog: DebugLogEntry[] = [];
let nextId = 1;

/** Get the path to the debug log file */
function getDebugLogPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, '_cache', 'debug-log.json');
}

/** Load persisted debug log from disk */
function loadDebugLog(): void {
  try {
    const logPath = getDebugLogPath();
    if (fs.existsSync(logPath)) {
      const data = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      debugLog = data.entries || [];
      nextId = data.nextId || (debugLog.length > 0 ? Math.max(...debugLog.map(e => e.id)) + 1 : 1);
      console.log('[DebugWindow] Loaded', debugLog.length, 'entries from disk');
    }
  } catch (err) {
    console.error('[DebugWindow] Failed to load debug log:', err);
    debugLog = [];
    nextId = 1;
  }
}

/** Save debug log to disk */
function saveDebugLog(): void {
  try {
    const logPath = getDebugLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(logPath, JSON.stringify({ entries: debugLog, nextId }, null, 2));
  } catch (err) {
    console.error('[DebugWindow] Failed to save debug log:', err);
  }
}

// Load debug log on module initialization
loadDebugLog();

/** Open (or focus) the debug window */
export function openDebugWindow(): void {
  console.log('[DebugWindow] openDebugWindow called');
  
  if (debugWindow && !debugWindow.isDestroyed()) {
    console.log('[DebugWindow] Focusing existing window');
    debugWindow.focus();
    return;
  }

  const htmlPath = path.join(__dirname, '..', '..', 'debug-window.html');
  console.log('[DebugWindow] Creating new window, loading:', htmlPath);

  debugWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'AI Session Debug',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  debugWindow.loadFile(htmlPath);
  debugWindow.webContents.openDevTools(); // Auto-open devtools for debugging
  
  debugWindow.on('closed', () => { 
    console.log('[DebugWindow] Window closed');
    debugWindow = null; 
  });

  // Once the window is ready, send the full log history
  debugWindow.webContents.on('did-finish-load', () => {
    console.log('[DebugWindow] did-finish-load, sending', debugLog.length, 'entries');
    debugWindow?.webContents.send('debug-log-init', debugLog);
  });
}

/** Record a new outgoing AI request. Returns the entry id for updating later. */
export function logRequest(baseUrl: string, model: string, messages: { role: string; content: string }[]): number {
  console.log('[DebugWindow] logRequest called, model:', model, 'messages:', messages.length);
  
  const entry: DebugLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    model,
    baseUrl,
    messages: messages.map(m => ({ ...m })),
    status: 'pending',
  };
  debugLog.push(entry);
  saveDebugLog(); // Persist to disk
  console.log('[DebugWindow] Total entries now:', debugLog.length);

  // Push to debug window if open
  if (debugWindow && !debugWindow.isDestroyed()) {
    console.log('[DebugWindow] Sending debug-log-entry to window');
    debugWindow.webContents.send('debug-log-entry', entry);
  } else {
    console.log('[DebugWindow] Window not open, entry stored for later');
  }

  return entry.id;
}

/** Update an existing entry with the result */
export function logResult(id: number, status: 'success' | 'error' | 'aborted', response?: string, error?: string, durationMs?: number): void {
  const entry = debugLog.find(e => e.id === id);
  if (!entry) return;
  entry.status = status;
  entry.response = response;
  entry.error = error;
  entry.durationMs = durationMs;
  saveDebugLog(); // Persist to disk

  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-update', { id, status, response, error, durationMs });
  }
}

/** Update an entry with streaming progress (partial response) */
export function logStreamingProgress(id: number, partialResponse: string): void {
  const entry = debugLog.find(e => e.id === id);
  if (!entry) return;
  
  // Update the partial response (don't change status yet)
  entry.response = partialResponse;
  // Note: We don't save on every streaming update for performance
  // The final result will be saved in logResult

  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-streaming', { id, partialResponse });
  }
}

/** Clear all debug entries */
export function clearDebugLog(): void {
  debugLog.length = 0;
  nextId = 1;
  saveDebugLog(); // Persist the cleared state
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-init', []);
  }
}

/** Register IPC handlers for the debug window */
export function registerDebugIpc(): void {
  ipcMain.handle('debug-open', () => {
    openDebugWindow();
    return { success: true };
  });

  ipcMain.handle('debug-clear', () => {
    clearDebugLog();
    return { success: true };
  });

  ipcMain.handle('debug-get-log', () => {
    return debugLog;
  });
}
