/**
 * Connector IPC Handlers
 * 
 * Bridges the ConnectorRegistry to Electron IPC so the renderer
 * can interact with connectors via the preload script.
 * 
 * This is only used in desktop (Electron) mode.
 * In cloud mode, the server/index.ts REST API handles the same operations.
 */

import { ipcMain } from 'electron';
import { getConnectorRegistry } from '@flovia/connectors';
import { restoreConnectorStates } from '@flovia/core/connector-bootstrap';
import type { PersistedConnectorData } from '@flovia/core/storage';
import {
  loadConnectorConfigs,
  saveConnectorConfig,
  saveConnectorState,
  loadSingleConnectorConfig,
} from './storage';

export function registerConnectorIpcHandlers(): void {
  const registry = getConnectorRegistry();

  // Restore saved configs AND states from disk into the in-memory registry
  restoreConnectorStates(registry, loadConnectorConfigs() as Record<string, PersistedConnectorData>);

  // List all connectors
  ipcMain.handle('connector-list', async () => {
    return registry.listConnectors();
  });

  // Get full connector details
  ipcMain.handle('connector-get', async (_event, connectorId: string) => {
    const connector = registry.get(connectorId);
    if (!connector) return null;
    return {
      metadata: connector.metadata,
      configFields: connector.configFields,
      actions: connector.actions,
      state: registry.getState(connectorId),
    };
  });

  // Get connector state
  ipcMain.handle('connector-get-state', async (_event, connectorId: string) => {
    return registry.getState(connectorId);
  });

  // Test connection — persist state to disk after result
  ipcMain.handle('connector-test', async (_event, connectorId: string, config: Record<string, unknown>) => {
    const result = await registry.testConnection(connectorId, config);
    // Persist the resulting state to disk
    const state = registry.getState(connectorId);
    saveConnectorState(connectorId, state);
    // If test succeeded, also persist the config (testConnection stores it in memory)
    if (result.success) {
      saveConnectorConfig(connectorId, config, state);
    }
    return result;
  });

  // Save config — persist to disk as well
  ipcMain.handle('connector-save-config', async (_event, connectorId: string, config: Record<string, unknown>) => {
    registry.setConfig(connectorId, config);
    saveConnectorConfig(connectorId, config);
    return { success: true };
  });

  // Load config — try in-memory first, then disk
  ipcMain.handle('connector-load-config', async (_event, connectorId: string) => {
    return registry.getConfig(connectorId) ?? loadSingleConnectorConfig(connectorId);
  });

  // Execute action
  ipcMain.handle('connector-execute', async (
    _event,
    connectorId: string,
    actionId: string,
    params?: Record<string, unknown>,
  ) => {
    return registry.executeAction(connectorId, actionId, params);
  });
}
