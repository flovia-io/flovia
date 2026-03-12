/**
 * Supabase API Client (Port — Driven Adapter)
 *
 * Pure HTTP + FS client for Supabase projects.
 * No Electron, no IPC, no framework deps.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupabaseConfig {
  detected: boolean;
  projectUrl: string | null;
  projectRef: string | null;
  sourceFile: string | null;
  serviceRoleKey?: string | null;
}

export interface SupabaseUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface SupabaseUsersResult { success: boolean; users: SupabaseUser[]; error?: string }

export interface SupabaseBucket {
  id: string; name: string; public: boolean;
  created_at: string; updated_at: string;
  file_size_limit: number | null; allowed_mime_types: string[] | null;
}

export interface SupabaseStorageResult { success: boolean; buckets: SupabaseBucket[]; error?: string }

export interface SupabaseTable { table_name: string; table_schema: string; table_type: string }
export interface SupabaseTablesResult { success: boolean; tables: SupabaseTable[]; error?: string }

export interface SqlQueryResult {
  success: boolean; data: Record<string, unknown>[]; columns: string[];
  rowCount: number; error?: string; executionTime?: number;
}

// ─── Env Detection Helpers ───────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output', 'coverage', '.cache',
]);

function extractUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[a-z0-9-]+\.supabase\.co[^\s"']*/i);
  return match ? match[0] : null;
}

function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

function extractServiceRoleKey(content: string): string | null {
  const patterns = [
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
    /SERVICE_ROLE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
    /SUPABASE_SERVICE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface EnvFileInfo { filePath: string; content: string; hasServiceRoleKey: boolean; hasProjectUrl: boolean }

function findAllSupabaseEnvFiles(dir: string, maxDepth = 4, currentDepth = 0): EnvFileInfo[] {
  const results: EnvFileInfo[] = [];
  if (currentDepth > maxDepth) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('.env')) {
        const filePath = path.join(dir, entry.name);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.toLowerCase().includes('supabase')) {
            results.push({ filePath, content, hasServiceRoleKey: extractServiceRoleKey(content) !== null, hasProjectUrl: extractUrl(content) !== null });
          }
        } catch { /* skip */ }
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        results.push(...findAllSupabaseEnvFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1));
      }
    }
  } catch { /* skip */ }
  return results;
}

function findBestSupabaseEnvFile(dir: string) {
  const allEnvFiles = findAllSupabaseEnvFiles(dir);
  if (allEnvFiles.length === 0) return null;

  allEnvFiles.sort((a, b) => {
    if (a.hasServiceRoleKey && !b.hasServiceRoleKey) return -1;
    if (!a.hasServiceRoleKey && b.hasServiceRoleKey) return 1;
    if (a.hasProjectUrl && !b.hasProjectUrl) return -1;
    if (!a.hasProjectUrl && b.hasProjectUrl) return 1;
    return 0;
  });

  const bestFile = allEnvFiles[0];
  let projectUrl = extractUrl(bestFile.content);
  let serviceRoleKey = extractServiceRoleKey(bestFile.content);

  if (!serviceRoleKey) {
    for (const envFile of allEnvFiles) {
      const key = extractServiceRoleKey(envFile.content);
      if (key) { serviceRoleKey = key; break; }
    }
  }
  if (!projectUrl) {
    for (const envFile of allEnvFiles) {
      const url = extractUrl(envFile.content);
      if (url) { projectUrl = url; break; }
    }
  }

  return { filePath: bestFile.filePath, content: bestFile.content, serviceRoleKey, projectUrl };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function detectSupabaseConfig(folderPath: string): SupabaseConfig {
  const result: SupabaseConfig = { detected: false, projectUrl: null, projectRef: null, sourceFile: null, serviceRoleKey: null };

  const found = findBestSupabaseEnvFile(folderPath);
  if (found) {
    result.detected = true;
    result.sourceFile = found.filePath;
    result.projectUrl = found.projectUrl;
    if (result.projectUrl) result.projectRef = extractProjectRef(result.projectUrl);
    result.serviceRoleKey = found.serviceRoleKey;
    return result;
  }

  const supabaseConfigPath = path.join(folderPath, 'supabase', 'config.toml');
  try { if (fs.existsSync(supabaseConfigPath)) { result.detected = true; result.sourceFile = supabaseConfigPath; } } catch { /* ignore */ }
  return result;
}

export async function fetchSupabaseUsers(projectUrl: string, serviceRoleKey: string): Promise<SupabaseUsersResult> {
  try {
    const response = await fetch(`${projectUrl}/auth/v1/admin/users`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return { success: false, users: [], error: `API error: ${response.status} - ${await response.text()}` };
    const data = await response.json() as { users?: SupabaseUser[] };
    return { success: true, users: data.users || [] };
  } catch (error) {
    return { success: false, users: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function fetchSupabaseStorage(projectUrl: string, serviceRoleKey: string): Promise<SupabaseStorageResult> {
  try {
    const response = await fetch(`${projectUrl}/storage/v1/bucket`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return { success: false, buckets: [], error: `API error: ${response.status} - ${await response.text()}` };
    const buckets = await response.json() as SupabaseBucket[];
    return { success: true, buckets: buckets || [] };
  } catch (error) {
    return { success: false, buckets: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function fetchSupabaseTables(projectUrl: string, serviceRoleKey: string): Promise<SupabaseTablesResult> {
  try {
    const schemaResponse = await fetch(`${projectUrl}/rest/v1/`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Accept': 'application/openapi+json' },
    });
    if (schemaResponse.ok) {
      const schemaData = await schemaResponse.json() as { paths?: Record<string, unknown> };
      const tables: SupabaseTable[] = [];
      if (schemaData.paths) {
        for (const p of Object.keys(schemaData.paths)) {
          const tableName = p.replace(/^\//, '').split('?')[0];
          if (tableName && !tableName.includes('/') && tableName !== 'rpc') {
            tables.push({ table_name: tableName, table_schema: 'public', table_type: 'BASE TABLE' });
          }
        }
      }
      tables.sort((a, b) => a.table_name.localeCompare(b.table_name));
      return { success: true, tables };
    }
    const defResponse = await fetch(`${projectUrl}/rest/v1/`, {
      method: 'OPTIONS',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey },
    });
    if (!defResponse.ok) return { success: false, tables: [], error: `Could not fetch schema: ${defResponse.status}` };
    return { success: true, tables: [] };
  } catch (error) {
    return { success: false, tables: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function executeSupabaseQuery(projectUrl: string, serviceRoleKey: string, query: string): Promise<SqlQueryResult> {
  const startTime = Date.now();
  try {
    const cleanQuery = query.trim();
    const selectMatch = cleanQuery.match(/^SELECT\s+(.+?)\s+FROM\s+["']?(\w+)["']?(?:\s+(.*))?$/i);

    if (selectMatch) {
      const [, selectColumns, tableName, rest] = selectMatch;
      let url = `${projectUrl}/rest/v1/${tableName}`;
      const params = new URLSearchParams();
      if (selectColumns.trim() !== '*') params.set('select', selectColumns.split(',').map(c => c.trim()).join(','));
      if (rest) {
        const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
        if (whereMatch) {
          const eqMatch = whereMatch[1].trim().match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
          if (eqMatch) params.set(eqMatch[1], `eq.${eqMatch[2]}`);
        }
        const limitMatch = rest.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) params.set('limit', limitMatch[1]);
        const orderMatch = rest.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        if (orderMatch) params.set('order', `${orderMatch[1]}${orderMatch[2]?.toLowerCase() === 'desc' ? '.desc' : '.asc'}`);
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'count=exact' },
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Query failed: ${response.status}`;
        try { errorMessage = JSON.parse(errorText).message || errorMessage; } catch { errorMessage = errorText || errorMessage; }
        return { success: false, data: [], columns: [], rowCount: 0, error: errorMessage, executionTime: Date.now() - startTime };
      }
      const data = await response.json() as Record<string, unknown>[];
      return { success: true, data, columns: data.length > 0 ? Object.keys(data[0]) : [], rowCount: data.length, executionTime: Date.now() - startTime };
    }

    // Non-SELECT: try RPC
    const rpcResponse = await fetch(`${projectUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery }),
    });
    if (rpcResponse.ok) {
      const data = await rpcResponse.json() as Record<string, unknown>[];
      return { success: true, data: Array.isArray(data) ? data : [], columns: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [], rowCount: Array.isArray(data) ? data.length : 0, executionTime: Date.now() - startTime };
    }
    return { success: false, data: [], columns: [], rowCount: 0, error: 'Complex queries require an exec_sql RPC function. Only simple SELECT queries are supported via PostgREST.', executionTime: Date.now() - startTime };
  } catch (error) {
    return { success: false, data: [], columns: [], rowCount: 0, error: error instanceof Error ? error.message : 'Unknown error', executionTime: Date.now() - startTime };
  }
}
