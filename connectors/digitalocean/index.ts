/**
 * DigitalOcean Connector — Self-contained plugin
 *
 * Provides access to DigitalOcean App Platform:
 * - List apps (displayed as files in the UI)
 * - List deployments for an app
 * - Trigger a new deployment
 * - Cancel a deployment
 * - View deployment logs
 *
 * All actions are implemented inline using the co-located API client.
 * No imports from `main/` — this connector is fully portable.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';
import * as api from './api';

export interface DigitalOceanConnectorConfig {
  token: string;
}

export const digitaloceanConnector: Connector<DigitalOceanConnectorConfig> = {
  metadata: {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'DigitalOcean App Platform — view apps, deployments, and deploy',
    icon: 'digitalocean',
    category: 'cloud',
    version: '1.0.0',
  },

  configFields: [
    {
      key: 'token',
      label: 'API Token',
      type: 'password',
      placeholder: 'dop_v1_...',
      required: true,
      helpText: 'Generate at cloud.digitalocean.com/account/api/tokens. Needs read+write scope.',
    },
  ],

  actions: [
    { id: 'list-apps', name: 'List Apps', description: 'List all App Platform apps', inputSchema: {} },
    {
      id: 'get-app', name: 'Get App', description: 'Get details for a specific app',
      inputSchema: { appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' } },
    },
    {
      id: 'list-deployments', name: 'List Deployments', description: 'List deployments for an app',
      inputSchema: {
        appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' },
        perPage: { type: 'number', label: 'Per Page', required: false, placeholder: '10' },
      },
    },
    {
      id: 'get-deployment', name: 'Get Deployment', description: 'Get details for a specific deployment',
      inputSchema: {
        appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' },
        deploymentId: { type: 'string', label: 'Deployment ID', required: true, placeholder: 'deployment-uuid' },
      },
    },
    {
      id: 'create-deployment', name: 'Deploy', description: 'Trigger a new deployment for an app',
      inputSchema: {
        appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' },
        forceBuild: { type: 'boolean', label: 'Force Build', required: false },
      },
    },
    {
      id: 'cancel-deployment', name: 'Cancel Deployment', description: 'Cancel a running deployment',
      inputSchema: {
        appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' },
        deploymentId: { type: 'string', label: 'Deployment ID', required: true, placeholder: 'deployment-uuid' },
      },
    },
    {
      id: 'get-deployment-logs', name: 'Get Logs', description: 'View build logs for a deployment',
      inputSchema: {
        appId: { type: 'string', label: 'App ID', required: true, placeholder: 'app-uuid' },
        deploymentId: { type: 'string', label: 'Deployment ID', required: true, placeholder: 'deployment-uuid' },
        componentName: { type: 'string', label: 'Component Name', required: false, placeholder: 'web' },
      },
    },
  ],

  async testConnection(config) {
    try {
      const token = config.token || process.env.DIGITALOCEAN_TOKEN;
      if (!token) return { success: false, error: 'No DigitalOcean API token provided' };
      const response = await fetch('https://api.digitalocean.com/v2/account', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) return { success: false, error: `DigitalOcean API returned ${response.status}` };
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    const token = config.token || process.env.DIGITALOCEAN_TOKEN || '';

    switch (actionId) {
      case 'list-apps':
        return api.listApps(token);
      case 'get-app':
        return api.getApp(token, params.appId as string);
      case 'list-deployments':
        return api.listDeployments(token, params.appId as string, params.perPage as number | undefined);
      case 'get-deployment':
        return api.getDeployment(token, params.appId as string, params.deploymentId as string);
      case 'create-deployment':
        return api.createDeployment(token, params.appId as string, params.forceBuild as boolean | undefined);
      case 'cancel-deployment':
        return api.cancelDeployment(token, params.appId as string, params.deploymentId as string);
      case 'get-deployment-logs':
        return api.getDeploymentLogs(
          token,
          params.appId as string,
          params.deploymentId as string,
          params.componentName as string | undefined,
        );
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
