/**
 * Atlassian / Jira Connector
 * 
 * Wraps the existing Atlassian integration as a Connector plugin.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';

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
    {
      key: 'domain',
      label: 'Atlassian Domain',
      type: 'text',
      placeholder: 'mycompany.atlassian.net',
      required: true,
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'user@company.com',
      required: true,
    },
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      placeholder: 'Your Atlassian API token',
      required: true,
      helpText: 'Generate at https://id.atlassian.com/manage-profile/security/api-tokens',
    },
  ],

  actions: [
    { id: 'test-connection', name: 'Test Connection', description: 'Verify credentials are valid' },
    { id: 'list-projects', name: 'List Projects', description: 'Fetch all Jira projects' },
    { id: 'list-issues', name: 'List Issues', description: 'Fetch issues for a project' },
  ],

  async testConnection(config) {
    const atlassian = await import('../main/atlassian');
    return atlassian.testConnection(config);
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    const atlassian = await import('../main/atlassian');

    switch (actionId) {
      case 'test-connection':
        return atlassian.testConnection(config);
      case 'list-projects':
        return atlassian.fetchProjects(config);
      case 'list-issues':
        return atlassian.fetchProjectIssues(
          config,
          params.projectKey as string,
          params.maxResults as number | undefined,
        );
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
