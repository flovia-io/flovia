/**
 * MCP (Model Context Protocol) Server types
 */

export interface McpServerConfig {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** npm package name to install (e.g. "@modelcontextprotocol/server-filesystem") */
  npmPackage: string;
  /** Optional version constraint */
  version?: string;
  /** Current status */
  status: McpServerStatus;
  /** Optional args to pass to the server */
  args?: string[];
  /** Optional environment variables */
  env?: Record<string, string>;
  /** When the server was added */
  addedAt: string;
  /** Available tools (populated after connecting) */
  tools?: McpTool[];
  /** Available resources (populated after connecting) */
  resources?: McpResource[];
  /** Last error message, if any */
  lastError?: string;
}

export type McpServerStatus = 'not-installed' | 'installing' | 'installed' | 'connecting' | 'connected' | 'error' | 'stopped';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/** Popular MCP servers for the registry/catalog */
export interface McpRegistryEntry {
  id: string;
  name: string;
  npmPackage: string;
  description: string;
  category: string;
  icon?: string;
}

export interface McpServersResult {
  servers: McpServerConfig[];
}
