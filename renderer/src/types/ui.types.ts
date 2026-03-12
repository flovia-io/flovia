/**
 * UI related types
 */
import type { CliProviderId } from './cliProvider.types';

export type SidePanel = 'explorer' | 'search' | 'source-control' | 'npm' | 'supabase' | 'database' | 'github' | 'atlassian' | 'mcp' | 'copilot' | 'gmail' | 'digitalocean';

/** Chat mode — local AI modes or external CLI provider via 'cli:<providerId>' */
export type ChatMode = 'Agent' | 'Chat' | 'Edit' | `cli:${CliProviderId}`;

/** Helper to check if a ChatMode is a CLI provider mode */
export function isCliMode(mode: ChatMode): mode is `cli:${CliProviderId}` {
  return mode.startsWith('cli:');
}

/** Extract the provider ID from a CLI chat mode */
export function getCliProviderId(mode: ChatMode): CliProviderId | null {
  if (!mode.startsWith('cli:')) return null;
  return mode.slice(4) as CliProviderId;
}
