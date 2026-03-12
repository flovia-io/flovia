/**
 * GitHub Connector
 * 
 * Wraps the existing GitHub integration as a Connector plugin.
 * Exposes GitHub Actions, Issues, and repo operations.
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';

export interface GitHubConnectorConfig {
  token: string;
}

export const githubConnector: Connector<GitHubConnectorConfig> = {
  metadata: {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub Actions, issues, and repository management',
    icon: 'github',
    category: 'source-control',
    version: '1.0.0',
  },

  configFields: [
    {
      key: 'token',
      label: 'Personal Access Token',
      type: 'password',
      placeholder: 'ghp_...',
      required: true,
      helpText: 'A GitHub PAT with repo and workflow scopes. Or set GITHUB_TOKEN env var.',
    },
  ],

  actions: [
    { id: 'extract-repo-info', name: 'Extract Repo Info', description: 'Parse owner/repo from a git remote URL' },
    { id: 'list-workflows', name: 'List Workflows', description: 'List GitHub Actions workflows for a repo' },
    { id: 'list-workflow-runs', name: 'List Workflow Runs', description: 'List recent runs for a workflow' },
    { id: 'list-run-jobs', name: 'List Run Jobs', description: 'List jobs within a workflow run' },
    { id: 'get-run-logs', name: 'Get Run Logs', description: 'Download logs for a workflow run' },
    { id: 'get-job-logs', name: 'Get Job Logs', description: 'Download logs for a specific job' },
    { id: 'rerun-workflow', name: 'Rerun Workflow', description: 'Re-run a failed or completed workflow' },
    { id: 'list-issues', name: 'List Issues', description: 'List issues for a repository' },
  ],

  async testConnection(config) {
    try {
      const token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      if (!token) {
        return { success: false, error: 'No GitHub token provided' };
      }
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
        },
      });
      if (!response.ok) {
        return { success: false, error: `GitHub API returned ${response.status}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    // Lazy-import to avoid pulling Electron deps in server mode
    const github = await import('../main/github');
    const token = config.token || undefined;

    switch (actionId) {
      case 'extract-repo-info': {
        const info = github.extractRepoInfo(params.remoteUrl as string);
        return { success: !!info, data: info };
      }
      case 'list-workflows':
        return github.listWorkflows(params.owner as string, params.repo as string);
      case 'list-workflow-runs':
        return github.listWorkflowRuns(
          params.owner as string,
          params.repo as string,
          params.workflowId as number | undefined,
          params.perPage as number | undefined,
        );
      case 'list-run-jobs':
        return github.listRunJobs(params.owner as string, params.repo as string, params.runId as number);
      case 'get-run-logs':
        return github.getRunLogs(params.owner as string, params.repo as string, params.runId as number);
      case 'get-job-logs':
        return github.getJobLogs(params.owner as string, params.repo as string, params.jobId as number);
      case 'rerun-workflow':
        return github.rerunWorkflow(params.owner as string, params.repo as string, params.runId as number);
      case 'list-issues':
        return github.listIssues(
          params.owner as string,
          params.repo as string,
          params.state as 'open' | 'closed' | 'all' | undefined,
          params.perPage as number | undefined,
        );
      default:
        return { success: false, error: `Unknown action: ${actionId}` };
    }
  },
};
