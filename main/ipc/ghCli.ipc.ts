/**
 * GitHub Copilot CLI IPC handlers
 * Detection, model listing, and streaming chat via the standalone `copilot` binary.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import {
  detectCopilotCli,
  copilotChat,
  copilotChatStream,
} from '../copilotCli';

let activeStream: { abort: () => void } | null = null;

export function registerGhCliIpc(getWindow: () => BrowserWindow | null): void {
  // Detect copilot CLI + list models
  ipcMain.handle('gh-cli-detect', async () => {
    return detectCopilotCli();
  });

  // Install — the standalone CLI is installed via npm/brew
  ipcMain.handle('gh-cli-install-copilot', async () => {
    return { success: false, error: 'Install the Copilot CLI via `npm install -g @githubnext/github-copilot-cli` or `brew install github/gh/copilot`.' };
  });

  // Non-streaming chat
  ipcMain.handle('gh-copilot-chat', async (_event, prompt: string, model?: string) => {
    return copilotChat(prompt, model);
  });

  // Streaming chat
  ipcMain.handle('gh-copilot-chat-stream', async (_event, prompt: string, model?: string) => {
    const win = getWindow();

    // Abort any existing stream
    if (activeStream) {
      activeStream.abort();
      activeStream = null;
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      activeStream = copilotChatStream(
        prompt,
        model,
        (chunk) => {
          win?.webContents.send('gh-copilot-chat-chunk', chunk);
        },
        () => {
          win?.webContents.send('gh-copilot-chat-chunk-done');
          activeStream = null;
          resolve({ success: true });
        },
        (err) => {
          win?.webContents.send('gh-copilot-chat-chunk-done');
          activeStream = null;
          resolve({ success: false, error: err });
        },
      );
    });
  });

  // Abort streaming
  ipcMain.handle('gh-copilot-chat-abort', async () => {
    if (activeStream) {
      activeStream.abort();
      activeStream = null;
    }
    return { success: true };
  });
}
