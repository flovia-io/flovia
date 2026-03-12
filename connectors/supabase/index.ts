/**
 * Supabase Connector — Self-contained plugin
 *
 * All actions implemented inline using the co-located API client.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';
import * as api from './api';

export interface SupabaseConnectorConfig {
  projectUrl: string;
  serviceRoleKey: string;
}

export const supabaseConnector: Connector<SupabaseConnectorConfig> = {
  metadata: {
    id: 'supabase',
    name: 'Supabase',
    description: 'Supabase database, auth, and storage management',
    icon: 'supabase',
    category: 'database',
    version: '1.0.0',
  },

  configFields: [
    { key: 'projectUrl', label: 'Project URL', type: 'url', placeholder: 'https://xxxx.supabase.co', required: true },
    {
      key: 'serviceRoleKey', label: 'Service Role Key', type: 'password', placeholder: 'eyJhbGci...', required: true,
      helpText: 'Found in Supabase Dashboard → Settings → API → service_role key',
    },
  ],

  actions: [
    {
      id: 'detect-config', name: 'Detect Config', description: 'Scan workspace for Supabase env files',
      inputSchema: { folderPath: { type: 'string', label: 'Folder Path', required: false, placeholder: '/path/to/project' } },
    },
    { id: 'get-users', name: 'Get Users', description: 'List all auth users', inputSchema: {} },
    { id: 'get-storage', name: 'Get Storage', description: 'List storage buckets', inputSchema: {} },
    { id: 'get-tables', name: 'Get Tables', description: 'List database tables', inputSchema: {} },
    {
      id: 'execute-query', name: 'Execute SQL', description: 'Run a SQL query',
      inputSchema: { query: { type: 'string', label: 'SQL Query', required: true, placeholder: 'SELECT * FROM users LIMIT 10' } },
    },
  ],

  async testConnection(config) {
    try {
      const res = await fetch(`${config.projectUrl}/rest/v1/`, {
        headers: { 'apikey': config.serviceRoleKey, 'Authorization': `Bearer ${config.serviceRoleKey}` },
      });
      return res.ok ? { success: true } : { success: false, error: `Supabase returned ${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    switch (actionId) {
      case 'detect-config':
        return { success: true, data: api.detectSupabaseConfig(params.folderPath as string) };
      case 'get-users':
        return api.fetchSupabaseUsers(config.projectUrl, config.serviceRoleKey);
      case 'get-storage':
        return api.fetchSupabaseStorage(config.projectUrl, config.serviceRoleKey);
      case 'get-tables':
        return api.fetchSupabaseTables(config.projectUrl, config.serviceRoleKey);
      case 'execute-query':
        return api.executeSupabaseQuery(config.projectUrl, config.serviceRoleKey, params.query as string);
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
