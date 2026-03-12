/**
 * Connector Index
 * 
 * Registers all built-in connectors and provides helpers for loading
 * third-party connectors from a directory.
 * 
 * To add a new connector:
 * 1. Create `connectors/my-service.connector.ts`
 * 2. Export a `Connector` implementation
 * 3. Import and add it to `builtInConnectors` below
 * 
 * That's it — the UI, IPC layer, and REST API all pick it up automatically.
 */

import { getConnectorRegistry, type Connector } from '@flovia/core/connector';
import { githubConnector } from './github';
import { atlassianConnector } from './atlassian';
import { supabaseConnector } from './supabase';
import { digitaloceanConnector } from './digitalocean';
import { gmailConnector } from './gmail.connector';

/**
 * All built-in connectors. Add new ones here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const builtInConnectors: Connector<any>[] = [
  githubConnector,
  atlassianConnector,
  supabaseConnector,
  digitaloceanConnector,
  gmailConnector,
  // ↓ Add new connectors here ↓
  // linearConnector,
  // slackConnector,
  // notionConnector,
  // datadogConnector,
];

/**
 * Register all built-in connectors with the global registry.
 * Call this once at app startup (in Electron main or server boot).
 */
export function registerBuiltInConnectors(): void {
  const registry = getConnectorRegistry();
  for (const connector of builtInConnectors) {
    if (!registry.get(connector.metadata.id)) {
      registry.register(connector);
    }
  }
}

/**
 * Re-export everything the rest of the app needs.
 */
export { getConnectorRegistry } from '@flovia/core/connector';
export type {
  Connector,
  ConnectorMetadata,
  ConnectorCategory,
  ConnectorConfigField,
  ConnectorAction,
  ConnectorActionResult,
  ConnectorState,
  ConnectorEvent,
} from '@flovia/core/connector';
