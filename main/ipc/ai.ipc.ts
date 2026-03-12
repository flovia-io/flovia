/**
 * AI IPC handlers
 */
import { ipcMain, type BrowserWindow as BW } from 'electron';
import { checkOllama, listModels, chatComplete, chatCompleteStream, type AISettings } from '../ai';
import { loadAISettings, saveAISettings, loadEnvApiKeys } from '../storage';
import { logRequest, logResult, logStreamingProgress } from '../debugWindow';

/** Active AI chat AbortController — allows the renderer to cancel an in-flight request */
let activeChatController: AbortController | null = null;

export function registerAiIpc(getWindow: () => BW | null): void {
  ipcMain.handle('ai-check-ollama', async () => checkOllama());

  ipcMain.handle('ai-list-models', async (_event, baseUrl: string, apiKey: string) => {
    return listModels(baseUrl, apiKey);
  });

  ipcMain.handle('ai-chat', async (_event, baseUrl: string, apiKey: string, model: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    const controller = new AbortController();
    activeChatController = controller;
    const debugId = logRequest(baseUrl, model, messages);
    const startTime = Date.now();

    try {
      const reply = await chatComplete(baseUrl, apiKey, model, messages, controller.signal);
      logResult(debugId, 'success', reply, undefined, Date.now() - startTime);
      return { success: true, reply };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        logResult(debugId, 'aborted', undefined, 'Aborted by user', Date.now() - startTime);
        return { success: false, error: 'aborted' };
      }
      const errMsg = (err as Error).message;
      logResult(debugId, 'error', undefined, errMsg, Date.now() - startTime);
      return { success: false, error: errMsg };
    } finally {
      if (activeChatController === controller) activeChatController = null;
    }
  });

  ipcMain.handle('ai-chat-stream', async (_event, baseUrl: string, apiKey: string, model: string, messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    const controller = new AbortController();
    activeChatController = controller;
    const debugId = logRequest(baseUrl, model, messages);
    const startTime = Date.now();
    const win = getWindow();
    let accumulatedResponse = '';

    try {
      const fullReply = await chatCompleteStream(
        baseUrl, apiKey, model, messages,
        (chunk: string) => {
          accumulatedResponse += chunk;
          logStreamingProgress(debugId, accumulatedResponse);
          if (win && !win.isDestroyed()) {
            win.webContents.send('ai-chat-chunk', chunk);
          }
        },
        controller.signal,
      );

      if (win && !win.isDestroyed()) {
        win.webContents.send('ai-chat-chunk-done');
      }
      logResult(debugId, 'success', fullReply, undefined, Date.now() - startTime);
      return { success: true, reply: fullReply };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        if (win && !win.isDestroyed()) win.webContents.send('ai-chat-chunk-done');
        logResult(debugId, 'aborted', accumulatedResponse || undefined, 'Aborted by user', Date.now() - startTime);
        return { success: false, error: 'aborted' };
      }
      const errMsg = (err as Error).message;
      logResult(debugId, 'error', undefined, errMsg, Date.now() - startTime);
      return { success: false, error: errMsg };
    } finally {
      if (activeChatController === controller) activeChatController = null;
    }
  });

  ipcMain.handle('ai-chat-abort', async () => {
    if (activeChatController) {
      activeChatController.abort();
      activeChatController = null;
    }
    return { success: true };
  });

  ipcMain.handle('ai-load-settings', async () => loadAISettings());

  ipcMain.handle('ai-save-settings', async (_event, settings: AISettings) => {
    saveAISettings(settings);
    return { success: true };
  });

  ipcMain.handle('ai-get-env-keys', async () => loadEnvApiKeys());
}
