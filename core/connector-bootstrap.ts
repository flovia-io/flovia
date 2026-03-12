/**
 * Connector Bootstrap — Shared initialization logic.
 *
 * Used by both Electron main process and the cloud server
 * to register built-in connectors and restore persisted state.
 * Eliminates the duplicated bootstrap code that lived in both adapters.
 */

import type { ConnectorRegistry, ConnectorState } from './connector';
import type { PersistedConnectorData } from './storage';

export type { PersistedConnectorData } from './storage';

/**
 * Restore saved connector configs and connection states into the in-memory registry.
 *
 * @param registry  The connector registry (already has connectors registered)
 * @param persisted Map of connectorId → { config, state } loaded from disk/DB
 */
export function restoreConnectorStates(
  registry: ConnectorRegistry,
  persisted: Record<string, PersistedConnectorData>,
): void {
  for (const [connectorId, data] of Object.entries(persisted)) {
    if (!registry.get(connectorId)) continue;
    if (!data.config || Object.keys(data.config).length === 0) continue;

    registry.setConfig(connectorId, data.config);

    if (data.state?.status === 'connected') {
      registry.setState(connectorId, {
        status: 'connected',
        lastConnected: data.state.lastConnected,
      } as ConnectorState);
    }
  }
}
