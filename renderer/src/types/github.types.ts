/**
 * GitHub Actions types
 */

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled' | 'deleted' | string;
  created_at: string;
  updated_at: string;
  html_url: string;
  badge_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  run_number: number;
  run_attempt: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  jobs_url: string;
  logs_url: string;
  event: string;
  actor: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubJob {
  id: number;
  run_id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  started_at: string | null;
  completed_at: string | null;
  steps: GitHubStep[];
}

export interface GitHubStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface GitHubWorkflowsResult {
  success: boolean;
  workflows: GitHubWorkflow[];
  error?: string;
}

export interface GitHubRunsResult {
  success: boolean;
  runs: GitHubWorkflowRun[];
  total_count: number;
  error?: string;
}

export interface GitHubJobsResult {
  success: boolean;
  jobs: GitHubJob[];
  error?: string;
}

export interface GitHubLogsResult {
  success: boolean;
  logs: string;
  error?: string;
}

export type GitHubIssueFilterState = 'open' | 'closed' | 'all';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: { id: number; name: string; color: string }[];
  user: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubIssuesResult {
  success: boolean;
  issues: GitHubIssue[];
  error?: string;
}
