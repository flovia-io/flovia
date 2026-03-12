/**
 * Atlassian/Jira API integration module
 * Uses Jira REST API v3 with token-based authentication (API token + email)
 *
 * This module is a pure API client — it does NOT know where connections
 * are stored. Persistence lives in `main/storage.ts`.
 */

export interface AtlassianConnection {
  domain: string;    // e.g. "mycompany.atlassian.net"
  email: string;     // e.g. "user@company.com"
  apiToken: string;  // Atlassian API token
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

/**
 * Build auth header for Jira API (Basic auth with email:apiToken)
 */
function buildAuthHeader(connection: AtlassianConnection): string {
  const token = Buffer.from(`${connection.email}:${connection.apiToken}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Make authenticated Jira REST API request
 */
async function jiraFetch<T>(
  connection: AtlassianConnection,
  endpoint: string,
): Promise<{ data: T | null; error?: string }> {
  try {
    const url = `https://${connection.domain}/rest/api/3${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': buildAuthHeader(connection),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Jira API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.errorMessages?.[0] || errorMessage;
      } catch {
        // Use default error message
      }
      return { data: null, error: errorMessage };
    }

    const data = await response.json() as T;
    return { data };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Test an Atlassian connection by fetching the current user
 */
export async function testConnection(connection: AtlassianConnection): Promise<AtlassianConnectionResult> {
  const result = await jiraFetch<{ accountId: string }>(connection, '/myself');
  if (result.error || !result.data) {
    return { success: false, error: result.error || 'Failed to connect' };
  }
  return { success: true };
}

/**
 * Fetch projects for an Atlassian connection
 */
export async function fetchProjects(connection: AtlassianConnection): Promise<AtlassianProjectsResult> {
  const result = await jiraFetch<{ values: Array<{
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    avatarUrls?: { '16x16'?: string };
  }> }>(connection, '/project/search?maxResults=50&orderBy=name');

  if (result.error || !result.data) {
    return { success: false, projects: [], error: result.error };
  }

  const projects: AtlassianProject[] = (result.data.values || []).map(p => ({
    id: p.id,
    key: p.key,
    name: p.name,
    projectTypeKey: p.projectTypeKey,
    avatarUrl: p.avatarUrls?.['16x16'],
  }));

  return { success: true, projects };
}

/**
 * Fetch issues (tickets) for a project
 */
export async function fetchProjectIssues(
  connection: AtlassianConnection,
  projectKey: string,
  maxResults: number = 30,
): Promise<AtlassianIssuesResult> {
  const jql = encodeURIComponent(`project = ${projectKey} ORDER BY updated DESC`);
  const result = await jiraFetch<{
    total: number;
    issues: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string; statusCategory?: { key: string } };
        priority?: { name: string };
        assignee?: { displayName: string };
        issuetype: { name: string };
        created: string;
        updated: string;
      };
    }>;
  }>(connection, `/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,priority,assignee,issuetype,created,updated`);

  if (result.error || !result.data) {
    return { success: false, issues: [], total: 0, error: result.error };
  }

  const issues: AtlassianIssue[] = (result.data.issues || []).map(i => ({
    id: i.id,
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status.name,
    statusCategory: i.fields.status.statusCategory?.key || 'indeterminate',
    priority: i.fields.priority?.name,
    assignee: i.fields.assignee?.displayName,
    issueType: i.fields.issuetype.name,
    created: i.fields.created,
    updated: i.fields.updated,
  }));

  return { success: true, issues, total: result.data.total || 0 };
}
