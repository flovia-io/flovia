/**
 * Atlassian/Jira types
 */

export interface AtlassianConnection {
  domain: string;
  email: string;
  apiToken: string;
}

export interface AtlassianProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl?: string;
}

export interface AtlassianIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done' | string;
  priority?: string;
  assignee?: string;
  issueType: string;
  created: string;
  updated: string;
}

export interface AtlassianProjectsResult {
  success: boolean;
  projects: AtlassianProject[];
  error?: string;
}

export interface AtlassianIssuesResult {
  success: boolean;
  issues: AtlassianIssue[];
  total: number;
  error?: string;
}

export interface AtlassianConnectionResult {
  success: boolean;
  error?: string;
}
