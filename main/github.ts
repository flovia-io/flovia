/**
 * GitHub API integration — BACKWARD COMPATIBILITY SHIM
 *
 * All real implementation has moved to `connectors/github/api.ts`.
 * This file re-exports everything so existing imports don't break.
 *
 * @deprecated Import from `connectors/github/api` instead.
 */
export {
  extractRepoInfo,
  listWorkflows,
  listWorkflowRuns,
  listRunJobs,
  getRunLogs,
  getJobLogs,
  listIssues,
  rerunWorkflow,
} from '@flovia/connectors/github/api';

export type {
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubJob,
  GitHubStep,
  GitHubIssue,
  GitHubRepoInfo,
  GitHubIssueFilterState,
  GitHubWorkflowsResult,
  GitHubRunsResult,
  GitHubJobsResult,
  GitHubLogsResult,
  GitHubIssuesResult,
} from '@flovia/connectors/github/api';

