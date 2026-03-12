/**
 * Atlassian / Jira Connector — Self-contained plugin
 *
 * All actions implemented inline using the co-located API client.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';
import * as api from './api';
export type { AtlassianConnection } from './api';

export interface AtlassianConnectorConfig {
  domain: string;
  email: string;
  apiToken: string;
}

export const atlassianConnector: Connector<AtlassianConnectorConfig> = {
  metadata: {
    id: 'atlassian',
    name: 'Atlassian / Jira',
    description: 'Jira project management — view projects, issues, and boards',
    icon: 'jira',
    category: 'project-management',
    version: '1.0.0',
  },

  configFields: [
    { key: 'domain', label: 'Atlassian Domain', type: 'text', placeholder: 'mycompany.atlassian.net', required: true },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'user@company.com', required: true },
    {
      key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Your Atlassian API token', required: true,
      helpText: 'Generate at https://id.atlassian.com/manage-profile/security/api-tokens',
    },
  ],

  actions: [
    { id: 'test-connection', name: 'Test Connection', description: 'Verify credentials are valid', inputSchema: {} },
    { id: 'list-projects', name: 'List Projects', description: 'Fetch all Jira projects', inputSchema: {} },
    {
      id: 'list-issues', name: 'List Issues', description: 'Fetch issues for a project',
      inputSchema: {
        projectKey: { type: 'string', label: 'Project Key', required: true, placeholder: 'PROJ' },
        maxResults: { type: 'number', label: 'Max Results', required: false, placeholder: '50' },
      },
    },
  ],

  async testConnection(config) {
    return api.testConnection(config);
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    switch (actionId) {
      case 'test-connection':
        return api.testConnection(config);
      case 'list-projects':
        return api.fetchProjects(config);
      case 'list-issues':
        return api.fetchProjectIssues(config, params.projectKey as string, params.maxResults as number | undefined);
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
