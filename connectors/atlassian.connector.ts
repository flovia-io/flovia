/**
 * Atlassian / Jira Connector
 * 
 * Wraps the existing Atlassian integration as a Connector plugin.
 */

import type { Connector, ConnectorActionResult, ConnectorTrigger } from '@flovia/core/connector';

export interface AtlassianConnectorConfig {
  domain: string;
  email: string;
  apiToken: string;
}

const atlassianTriggers: ConnectorTrigger[] = [
  {
    id: 'jira-trigger',
    name: 'Jira Trigger',
    description: 'Trigger workflow on Jira events',
    events: [
      { value: 'jira:issue_created', label: 'Issue Created', description: 'A new Jira issue is created' },
      { value: 'jira:issue_updated', label: 'Issue Updated', description: 'A Jira issue is updated' },
      { value: 'jira:issue_deleted', label: 'Issue Deleted', description: 'A Jira issue is deleted' },
      { value: 'comment_created', label: 'Comment Created', description: 'A comment is added to an issue' },
      { value: 'sprint_started', label: 'Sprint Started', description: 'A sprint has started' },
      { value: 'sprint_closed', label: 'Sprint Closed', description: 'A sprint has been closed' },
    ],
    inputFields: [
      {
        key: 'projectKey',
        label: 'Project Key',
        type: 'text',
        placeholder: 'PROJ',
        required: false,
        helpText: 'Filter events to a specific project (optional)',
      },
    ],
  },
];

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

  triggers: atlassianTriggers,

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
