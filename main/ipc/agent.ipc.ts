/**
 * Agent Config IPC handlers
 */
import { ipcMain } from 'electron';
import {
  loadAgentConfigs,
  saveAgentConfig,
  deleteAgentConfig,
  type StoredAgentConfig,
} from '../storage';

export function registerAgentIpc(): void {
  ipcMain.handle('agent-load-configs', async () => loadAgentConfigs());

  ipcMain.handle('agent-save-config', async (_event, config: StoredAgentConfig) => {
    saveAgentConfig(config);
    return { success: true };
  });

  ipcMain.handle('agent-delete-config', async (_event, agentId: string) => {
    const deleted = deleteAgentConfig(agentId);
    return { success: deleted };
  });
}
