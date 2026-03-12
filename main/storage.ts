/**
 * Centralized user-data persistence layer.
 *
 * All JSON settings / credential files that live in the user-data directory
 * are read / written through this module. Domain modules (ai, prompts,
 * atlassian, etc.) stay pure — they never know *where* data is stored.
 *
 * Connector-related persistence is delegated to `core/storage.ts` (StoragePort).
 */
import * as fs from 'fs';
import * as path from 'path';
import { getUserDataDir } from '@flovia/core/dataDir';
import { getStorage } from '@flovia/core/storage';
import { upsertById, removeById } from '@flovia/core/utils';
export type { PersistedConnectorData, StoragePort } from '@flovia/core/storage';

// ── helpers ──────────────────────────────────────────────────────────────────

function dataFile(name: string): string {
  return path.join(getUserDataDir(), name);
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── AI Settings ──────────────────────────────────────────────────────────────

import type { AISettings } from './ai';

const AI_SETTINGS_FILE = () => dataFile('ai-settings.json');

const DEFAULT_OLLAMA: AISettings = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  selectedModel: '',
};

/**
 * Build default AI settings from environment variables.
 * Priority: ANTHROPIC_API_KEY → OPENAI_API_KEY → Ollama (local).
 */
function defaultsFromEnv(): AISettings {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiBase = process.env.OPENAI_BASE_URL?.trim();
  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim();
  const ollamaKey = process.env.OLLAMA_API_KEY?.trim();
  const defaultModel = process.env.FLOVIA_MODEL?.trim() || '';

  if (anthropicKey) {
    return { provider: 'anthropic', baseUrl: 'anthropic', apiKey: anthropicKey, selectedModel: defaultModel };
  }
  if (openaiKey) {
    return { provider: 'openai', baseUrl: openaiBase || 'https://api.openai.com/v1', apiKey: openaiKey, selectedModel: defaultModel };
  }
  return {
    provider: 'ollama',
    baseUrl: ollamaBase || 'http://localhost:11434/v1',
    apiKey: ollamaKey || 'ollama',
    selectedModel: defaultModel,
  };
}

export function loadAISettings(): AISettings {
  const saved = readJSON<AISettings | null>(AI_SETTINGS_FILE(), null);
  const envDefaults = defaultsFromEnv();
  const envKeys = loadEnvApiKeys();

  if (saved) {
    // For the saved provider, prefer the .env key if one exists (it's the
    // source of truth for credentials), otherwise keep the saved key.
    const envForProvider = envKeys[saved.provider];
    const apiKey = envForProvider?.apiKey || saved.apiKey || envDefaults.apiKey;
    const baseUrl = saved.provider === 'ollama'
      ? (saved.baseUrl || envForProvider?.baseUrl || envDefaults.baseUrl)
      : (saved.baseUrl || envDefaults.baseUrl);

    return {
      provider: saved.provider,
      baseUrl,
      apiKey,
      selectedModel: saved.selectedModel || envDefaults.selectedModel,
    };
  }

  return envDefaults;
}

export function saveAISettings(settings: AISettings): void {
  writeJSON(AI_SETTINGS_FILE(), settings);
}

/** Return env-based API keys for every known provider (used by settings UI to pre-fill fields). */
export function loadEnvApiKeys(): Record<string, { apiKey: string; baseUrl: string }> {
  const result: Record<string, { apiKey: string; baseUrl: string }> = {};

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    result.anthropic = { apiKey: anthropicKey, baseUrl: 'anthropic' };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    result.openai = { apiKey: openaiKey, baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1' };
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim();
  const ollamaKey = process.env.OLLAMA_API_KEY?.trim();
  // Use empty string (not 'ollama') so loadAISettings() falls through to the
  // user-saved key when the env var is not set (see line 82).
  result.ollama = { apiKey: ollamaKey || '', baseUrl: ollamaBase || 'http://localhost:11434/v1' };

  return result;
}

// ── Prompt Settings ──────────────────────────────────────────────────────────

import type { PromptSettings } from './prompts';
import { DEFAULT_PROMPTS } from './prompts';

const PROMPTS_FILE = () => dataFile('prompt-settings.json');

export function loadPromptSettings(): PromptSettings {
  const saved = readJSON<Partial<PromptSettings>>(PROMPTS_FILE(), {});
  return { ...DEFAULT_PROMPTS, ...saved };
}

export function savePromptSettings(prompts: PromptSettings): void {
  writeJSON(PROMPTS_FILE(), prompts);
}

export function resetPromptSettings(): PromptSettings {
  writeJSON(PROMPTS_FILE(), DEFAULT_PROMPTS);
  return { ...DEFAULT_PROMPTS };
}

// ── Atlassian Connections ────────────────────────────────────────────────────
// MIGRATION: Reads from generic connector config first, falls back to legacy file.

import type { AtlassianConnection } from './atlassian';

const ATLASSIAN_FILE = () => dataFile('atlassian-connections.json');

/**
 * Load Atlassian connections. Reads from the generic connector config store
 * first (connector id "atlassian"). Falls back to the legacy JSON file.
 * Environment variables still take precedence.
 */
export function loadAtlassianConnections(): AtlassianConnection[] {
  // Try generic connector config first
  const connectorConfig = getStorage().loadSingleConnectorConfig('atlassian') as Record<string, unknown> | null;
  if (connectorConfig && connectorConfig.domain && connectorConfig.email && connectorConfig.apiToken) {
    const connections: AtlassianConnection[] = [{
      domain: connectorConfig.domain as string,
      email: connectorConfig.email as string,
      apiToken: connectorConfig.apiToken as string,
    }];
    return mergeAtlassianEnvConnection(connections);
  }

  // Fallback: legacy atlassian-connections.json
  const saved = readJSON<AtlassianConnection[]>(ATLASSIAN_FILE(), []);
  return mergeAtlassianEnvConnection(saved);
}

function mergeAtlassianEnvConnection(saved: AtlassianConnection[]): AtlassianConnection[] {
  const domain = process.env.ATLASSIAN_DOMAIN;
  const email = process.env.ATLASSIAN_EMAIL;
  const apiToken = process.env.ATLASSIAN_API_TOKEN;

  if (domain && email && apiToken) {
    const envConnection: AtlassianConnection = { domain, email, apiToken };
    const exists = saved.some(c => c.domain === domain && c.email === email);
    if (!exists) return [envConnection, ...saved];
    return saved.map(c =>
      c.domain === domain && c.email === email ? { ...c, apiToken } : c,
    );
  }
  return saved;
}

export function saveAtlassianConnections(connections: AtlassianConnection[]): void {
  // Write to legacy file for backward compat
  writeJSON(ATLASSIAN_FILE(), connections);

  // Also sync to generic connector config (first connection becomes the config)
  if (connections.length > 0) {
    const first = connections[0];
    getStorage().saveConnectorConfig('atlassian', {
      domain: first.domain,
      email: first.email,
      apiToken: first.apiToken,
    }, { status: 'connected', lastConnected: new Date().toISOString() });
  }
}

// ── MCP Servers ──────────────────────────────────────────────────────────────

import type { McpServerConfig } from './mcpServers';

const MCP_SERVERS_FILE = () => dataFile('mcp-servers.json');

export function loadMcpServers(): McpServerConfig[] {
  return readJSON<McpServerConfig[]>(MCP_SERVERS_FILE(), []);
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  writeJSON(MCP_SERVERS_FILE(), servers);
}

// ── Agent Configs ────────────────────────────────────────────────────────────

export interface StoredAgentConfig {
  id: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

const AGENTS_FILE = () => dataFile('agent-configs.json');

export function loadAgentConfigs(): StoredAgentConfig[] {
  return readJSON<StoredAgentConfig[]>(AGENTS_FILE(), []);
}

export function saveAgentConfigs(configs: StoredAgentConfig[]): void {
  writeJSON(AGENTS_FILE(), configs);
}

export function saveAgentConfig(config: StoredAgentConfig): void {
  const all = loadAgentConfigs();
  saveAgentConfigs(upsertById(all, config));
}

export function deleteAgentConfig(agentId: string): boolean {
  const all = loadAgentConfigs();
  const { list, removed } = removeById(all, agentId);
  if (!removed) return false;
  saveAgentConfigs(list);
  return true;
}

// ── Connector Configs (delegated to core/storage.ts StoragePort) ─────────────

/**
 * All connector persistence is delegated to the StoragePort.
 * These re-exports keep existing callsites working without changes.
 */
export function loadConnectorConfigs() {
  return getStorage().loadConnectorConfigs();
}

export function saveConnectorConfig(
  connectorId: string,
  config: Record<string, unknown>,
  state?: { status: string; error?: string; lastConnected?: string },
): void {
  getStorage().saveConnectorConfig(connectorId, config, state);
}

export function saveConnectorState(
  connectorId: string,
  state: { status: string; error?: string; lastConnected?: string },
): void {
  getStorage().saveConnectorState(connectorId, state);
}

export function loadSingleConnectorConfig(connectorId: string): Record<string, unknown> | null {
  return getStorage().loadSingleConnectorConfig(connectorId) as Record<string, unknown> | null;
}
