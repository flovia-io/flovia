/**
 * ───────────────────────────────────────────────────────
 *  CONNECTOR TEMPLATE
 * ───────────────────────────────────────────────────────
 * 
 * Copy this file to create a new connector.
 * 
 * Steps:
 * 1. Copy this file as `connectors/my-service.connector.ts`
 * 2. Fill in the metadata, config fields, and actions
 * 3. Implement testConnection() and executeAction()
 * 4. Import and add to `builtInConnectors` in `connectors/index.ts`
 * 5. Done! The UI and API will pick it up automatically.
 * 
 * ───────────────────────────────────────────────────────
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';

// 1. Define your config shape
export interface MyServiceConfig {
  apiKey: string;
  baseUrl: string;
}

// 2. Implement the connector
export const myServiceConnector: Connector<MyServiceConfig> = {
  metadata: {
    id: 'my-service',                // Unique ID
    name: 'My Service',              // Display name
    description: 'Description here', // Short description
    icon: 'my-service',              // Icon identifier
    category: 'other',               // source-control | project-management | database | ci-cd | communication | cloud | monitoring | ai | other
    version: '1.0.0',
  },

  // 3. Define what config the user needs to provide
  configFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'sk-...',
      required: true,
      helpText: 'Get your API key from https://my-service.com/settings',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      placeholder: 'https://api.my-service.com',
      required: false,
    },
  ],

  // 4. Define what actions this connector can do
  actions: [
    {
      id: 'list-items',
      name: 'List Items',
      description: 'Fetch all items from the service',
    },
    {
      id: 'get-item',
      name: 'Get Item',
      description: 'Get a specific item by ID',
    },
    {
      id: 'create-item',
      name: 'Create Item',
      description: 'Create a new item',
    },
  ],

  // 5. Implement connection test
  async testConnection(config) {
    try {
      const res = await fetch(`${config.baseUrl}/api/me`, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
      });
      return res.ok
        ? { success: true }
        : { success: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  // 6. Implement actions
  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    switch (actionId) {
      case 'list-items': {
        const res = await fetch(`${config.baseUrl}/api/items`, { headers });
        const data = await res.json();
        return { success: true, data };
      }
      case 'get-item': {
        const res = await fetch(`${config.baseUrl}/api/items/${params.id}`, { headers });
        const data = await res.json();
        return { success: true, data };
      }
      case 'create-item': {
        const res = await fetch(`${config.baseUrl}/api/items`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });
        const data = await res.json();
        return { success: true, data };
      }
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
