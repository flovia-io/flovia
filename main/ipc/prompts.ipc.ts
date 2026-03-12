/**
 * Prompt Settings IPC handlers
 */
import { ipcMain } from 'electron';
import type { PromptSettings } from '../prompts';
import { loadPromptSettings, savePromptSettings, resetPromptSettings } from '../storage';

export function registerPromptsIpc(): void {
  ipcMain.handle('prompts-load', async () => loadPromptSettings());

  ipcMain.handle('prompts-save', async (_event, prompts: PromptSettings) => {
    savePromptSettings(prompts);
    return { success: true };
  });

  ipcMain.handle('prompts-reset', async () => resetPromptSettings());
}
