/**
 * CLI Provider IPC handlers
 *
 * Generic IPC layer for all external CLI-based AI providers.
 * Replaces the old Copilot-specific `ghCli.ipc.ts`.
 *
 * Channels:
 *   cli-provider-detect-all       → detect all known CLI providers
 *   cli-provider-detect           → detect a single provider by id
 *   cli-provider-chat             → non-streaming chat
 *   cli-provider-chat-stream      → streaming chat (sends chunks via events)
 *   cli-provider-chat-abort       → abort active stream
 *
 * Streaming events (renderer → main):
 *   cli-provider-chat-chunk       → { providerId, chunk }
 *   cli-provider-chat-chunk-done  → { providerId }
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { CliProviderId } from '@flovia/core/cliProvider';
import {
  detectAllCliProviders,
  detectCliProvider,
  cliChat,
  cliChatStream,
} from '../cliProviders';

let activeStream: { abort: () => void } | null = null;

export function registerCliProviderIpc(getWindow: () => BrowserWindow | null): void {
  // ── Detect all providers ──
  ipcMain.handle('cli-provider-detect-all', async () => {
    return detectAllCliProviders();
  });

  // ── Detect single provider ──
  ipcMain.handle('cli-provider-detect', async (_event, providerId: CliProviderId) => {
    return detectCliProvider(providerId);
  });

  // ── Non-streaming chat ──
  ipcMain.handle('cli-provider-chat', async (_event, providerId: CliProviderId, prompt: string, model?: string) => {
    return cliChat(providerId, prompt, model);
  });

  // ── Streaming chat ──
  ipcMain.handle('cli-provider-chat-stream', async (_event, providerId: CliProviderId, prompt: string, model?: string) => {
    const win = getWindow();

    if (activeStream) {
      activeStream.abort();
      activeStream = null;
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      activeStream = cliChatStream(
        providerId,
        prompt,
        model,
        (chunk) => {
          win?.webContents.send('cli-provider-chat-chunk', chunk);
        },
        () => {
          win?.webContents.send('cli-provider-chat-chunk-done');
          activeStream = null;
          resolve({ success: true });
        },
        (err) => {
          win?.webContents.send('cli-provider-chat-chunk-done');
          activeStream = null;
          resolve({ success: false, error: err });
        },
      );
    });
  });

  // ── Abort ──
  ipcMain.handle('cli-provider-chat-abort', async () => {
    if (activeStream) {
      activeStream.abort();
      activeStream = null;
    }
    return { success: true };
  });

  // ── Legacy aliases (backward compat with old preload.js channels) ──
  // These forward to the new generic handlers so old preload code still works.
  ipcMain.handle('gh-cli-detect', async () => detectCliProvider('copilot'));
  ipcMain.handle('gh-cli-install-copilot', async () => ({
    success: false,
    error: 'Install the Copilot CLI via `npm install -g @githubnext/github-copilot-cli` or `brew install github/gh/copilot`.',
  }));
  ipcMain.handle('gh-copilot-chat', async (_event, prompt: string, model?: string) => {
    return cliChat('copilot', prompt, model);
  });
  ipcMain.handle('gh-copilot-chat-stream', async (_event, prompt: string, model?: string) => {
    const win = getWindow();
    if (activeStream) { activeStream.abort(); activeStream = null; }
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      activeStream = cliChatStream('copilot', prompt, model,
        (chunk) => { win?.webContents.send('gh-copilot-chat-chunk', chunk); },
        () => { win?.webContents.send('gh-copilot-chat-chunk-done'); activeStream = null; resolve({ success: true }); },
        (err) => { win?.webContents.send('gh-copilot-chat-chunk-done'); activeStream = null; resolve({ success: false, error: err }); },
      );
    });
  });
  ipcMain.handle('gh-copilot-chat-abort', async () => {
    if (activeStream) { activeStream.abort(); activeStream = null; }
    return { success: true };
  });
}
