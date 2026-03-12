/**
 * DigitalOcean API Client (Port — Driven Adapter)
 *
 * Pure HTTP client for the DigitalOcean REST API.
 * No Electron, no IPC, no framework deps — just fetch().
 * Used by the DigitalOcean connector plugin and nothing else.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DOApp {
  id: string;
  owner_uuid?: string;
  spec: DOAppSpec;
  default_ingress?: string;
  created_at: string;
  updated_at?: string;
  active_deployment?: DODeployment;
  last_deployment_active_at?: string;
  live_url?: string;
  live_url_base?: string;
  live_domain?: string;
  region?: { slug: string; label: string };
}

export interface DOAppSpec {
  name: string;
  region?: string;
  services?: DOServiceSpec[];
  static_sites?: DOStaticSiteSpec[];
  workers?: DOWorkerSpec[];
}

export interface DOServiceSpec {
  name: string;
  source_dir?: string;
  github?: { repo: string; branch?: string; deploy_on_push?: boolean };
  image?: { registry_type: string; repository: string; tag?: string };
  instance_count?: number;
  instance_size_slug?: string;
  http_port?: number;
}

export interface DOStaticSiteSpec {
  name: string;
  source_dir?: string;
  github?: { repo: string; branch?: string; deploy_on_push?: boolean };
  build_command?: string;
  output_dir?: string;
}

export interface DOWorkerSpec {
  name: string;
  source_dir?: string;
  github?: { repo: string; branch?: string; deploy_on_push?: boolean };
  image?: { registry_type: string; repository: string; tag?: string };
}

export interface DODeployment {
  id: string;
  spec: DOAppSpec;
  cause: string;
  phase: DODeploymentPhase;
  created_at: string;
  updated_at?: string;
  progress?: { steps?: DODeploymentStep[] };
}

export type DODeploymentPhase =
  | 'UNKNOWN'
  | 'PENDING_BUILD'
  | 'BUILDING'
  | 'PENDING_DEPLOY'
  | 'DEPLOYING'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'ERROR'
  | 'CANCELED';

export interface DODeploymentStep {
  name: string;
  status: 'UNKNOWN' | 'PENDING' | 'RUNNING' | 'ERROR' | 'SUCCESS';
  started_at?: string;
  ended_at?: string;
  component_name?: string;
}

export interface DODeploymentLog {
  historic_urls?: string[];
  live_url?: string;
}

// ─── Result types ────────────────────────────────────────────────────────────

export interface DOAppsResult { success: boolean; apps: DOApp[]; error?: string }
export interface DOAppResult { success: boolean; app: DOApp | null; error?: string }
export interface DODeploymentsResult { success: boolean; deployments: DODeployment[]; error?: string }
export interface DODeploymentResult { success: boolean; deployment: DODeployment | null; error?: string }
export interface DOLogsResult { success: boolean; logs: string; error?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function doFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error?: string }> {
  if (!token) return { data: null, error: 'DigitalOcean API token not provided.' };
  try {
    const response = await fetch(`https://api.digitalocean.com/v2${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `DigitalOcean API error: ${response.status}`;
      try { errorMessage = JSON.parse(errorText).message || errorMessage; } catch { /* use default */ }
      return { data: null, error: errorMessage };
    }
    // 204 No Content
    if (response.status === 204) return { data: null };
    return { data: await response.json() as T };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** List all App Platform apps. */
export async function listApps(token: string): Promise<DOAppsResult> {
  const result = await doFetch<{ apps: DOApp[] }>('/apps', token);
  if (result.error || !result.data) return { success: false, apps: [], error: result.error };
  return { success: true, apps: result.data.apps || [] };
}

/** Get a single app by ID. */
export async function getApp(token: string, appId: string): Promise<DOAppResult> {
  const result = await doFetch<{ app: DOApp }>(`/apps/${appId}`, token);
  if (result.error || !result.data) return { success: false, app: null, error: result.error };
  return { success: true, app: result.data.app };
}

/** List deployments for an app. */
export async function listDeployments(
  token: string,
  appId: string,
  perPage = 10,
): Promise<DODeploymentsResult> {
  const result = await doFetch<{ deployments: DODeployment[] }>(
    `/apps/${appId}/deployments?per_page=${perPage}`,
    token,
  );
  if (result.error || !result.data) return { success: false, deployments: [], error: result.error };
  return { success: true, deployments: result.data.deployments || [] };
}

/** Get a single deployment by ID. */
export async function getDeployment(
  token: string,
  appId: string,
  deploymentId: string,
): Promise<DODeploymentResult> {
  const result = await doFetch<{ deployment: DODeployment }>(
    `/apps/${appId}/deployments/${deploymentId}`,
    token,
  );
  if (result.error || !result.data) return { success: false, deployment: null, error: result.error };
  return { success: true, deployment: result.data.deployment };
}

/** Create (trigger) a new deployment for an app. */
export async function createDeployment(
  token: string,
  appId: string,
  forceBuild = true,
): Promise<DODeploymentResult> {
  const result = await doFetch<{ deployment: DODeployment }>(
    `/apps/${appId}/deployments`,
    token,
    { method: 'POST', body: JSON.stringify({ force_build: forceBuild }) },
  );
  if (result.error || !result.data) return { success: false, deployment: null, error: result.error };
  return { success: true, deployment: result.data.deployment };
}

/** Cancel a running deployment. */
export async function cancelDeployment(
  token: string,
  appId: string,
  deploymentId: string,
): Promise<DODeploymentResult> {
  const result = await doFetch<{ deployment: DODeployment }>(
    `/apps/${appId}/deployments/${deploymentId}/cancel`,
    token,
    { method: 'POST' },
  );
  if (result.error || !result.data) return { success: false, deployment: null, error: result.error };
  return { success: true, deployment: result.data.deployment };
}

/** Get aggregated deployment logs. */
export async function getDeploymentLogs(
  token: string,
  appId: string,
  deploymentId: string,
  componentName?: string,
): Promise<DOLogsResult> {
  const component = componentName ? `/components/${componentName}` : '';
  const logType = 'BUILD';
  const result = await doFetch<DODeploymentLog>(
    `/apps/${appId}/deployments/${deploymentId}${component}/logs?type=${logType}&follow=false`,
    token,
  );
  if (result.error || !result.data) return { success: false, logs: '', error: result.error };

  // The DO API returns historic_urls or live_url for streaming; fetch the first historic URL
  if (result.data.historic_urls && result.data.historic_urls.length > 0) {
    try {
      const logRes = await fetch(result.data.historic_urls[0]);
      if (logRes.ok) return { success: true, logs: await logRes.text() };
    } catch { /* fall through */ }
  }

  return { success: true, logs: '[No logs available yet. Deployment may still be in progress.]' };
}
