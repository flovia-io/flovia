import * as pty from 'node-pty';
import { ipcMain, type BrowserWindow } from 'electron';
import * as path from 'path';

const terminals = new Map<string, pty.IPty>();
let terminalCounter = 0;

function defaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

export function registerTerminalHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('terminal-create', (_event, cwd: string) => {
    const id = `term-${++terminalCounter}`;
    const shell = defaultShell();

    try {
      const term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      });

      terminals.set(id, term);

      term.onData((data: string) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-data', id, data);
        }
      });

      term.onExit(() => {
        terminals.delete(id);
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-exit', id);
        }
      });

      return { id, shell: path.basename(shell) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[terminal] Failed to spawn "${shell}" in "${cwd}":`, msg);

      if (msg.includes('posix_spawnp')) {
        throw new Error(
          `Failed to spawn terminal: node-pty native module is not compatible with this Electron version. ` +
          `Run "npm run rebuild" (or "npx electron-rebuild -f -w node-pty") and restart the app.`
        );
      }
      throw new Error(`Failed to spawn terminal (${shell}): ${msg}`);
    }
  });

  ipcMain.on('terminal-input', (_event, id: string, data: string) => {
    const term = terminals.get(id);
    if (term) term.write(data);
  });

  ipcMain.on('terminal-resize', (_event, id: string, cols: number, rows: number) => {
    const term = terminals.get(id);
    if (term) {
      try { term.resize(cols, rows); } catch { /* ignore resize errors */ }
    }
  });

  ipcMain.handle('terminal-kill', (_event, id: string) => {
    const term = terminals.get(id);
    if (term) {
      term.kill();
      terminals.delete(id);
    }
  });
}

export function killAllTerminals(): void {
  for (const [id, term] of terminals) {
    try { term.kill(); } catch { /* ignore */ }
    terminals.delete(id);
  }
}
