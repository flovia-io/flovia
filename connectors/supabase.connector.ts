/**
 * Supabase Connector
 * 
 * Wraps the existing Supabase integration as a Connector plugin.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';

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
    {
      key: 'projectUrl',
      label: 'Project URL',
      type: 'url',
      placeholder: 'https://xxxx.supabase.co',
      required: true,
    },
    {
      key: 'serviceRoleKey',
      label: 'Service Role Key',
      type: 'password',
      placeholder: 'eyJhbGci...',
      required: true,
      helpText: 'Found in Supabase Dashboard → Settings → API → service_role key',
    },
  ],

  actions: [
    { id: 'get-users', name: 'Get Users', description: 'List all auth users' },
    { id: 'get-storage', name: 'Get Storage', description: 'List storage buckets' },
    { id: 'get-tables', name: 'Get Tables', description: 'List database tables' },
    { id: 'execute-query', name: 'Execute SQL', description: 'Run a SQL query' },
  ],

  async testConnection(config) {
    try {
      const res = await fetch(`${config.projectUrl}/rest/v1/`, {
        headers: {
          'apikey': config.serviceRoleKey,
          'Authorization': `Bearer ${config.serviceRoleKey}`,
        },
      });
      return res.ok
        ? { success: true }
        : { success: false, error: `Supabase returned ${res.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    const supabase = await import('../main/supabase');

    switch (actionId) {
      case 'get-users':
        return supabase.fetchSupabaseUsers(config.projectUrl, config.serviceRoleKey);
      case 'get-storage':
        return supabase.fetchSupabaseStorage(config.projectUrl, config.serviceRoleKey);
      case 'get-tables':
        return supabase.fetchSupabaseTables(config.projectUrl, config.serviceRoleKey);
      case 'execute-query':
        return supabase.executeSupabaseQuery(
          config.projectUrl,
          config.serviceRoleKey,
          params.query as string,
        );
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
