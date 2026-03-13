/**
 * UI related types
 */
import type { CliProviderId } from './cliProvider.types';

export type SidePanel = 'explorer' | 'workflows' | 'search' | 'source-control' | 'npm' | 'supabase' | 'database' | 'github' | 'atlassian' | 'mcp' | 'copilot' | 'gmail' | 'digitalocean';

/** Chat mode — local AI modes, external CLI provider via 'cli:<providerId>', or custom workflow via 'wf:<workflowId>' */
export type ChatMode = 'Agent' | 'Chat' | `cli:${CliProviderId}` | `wf:${string}`;

/** Helper to check if a ChatMode is a CLI provider mode */
export function isCliMode(mode: ChatMode): mode is `cli:${CliProviderId}` {
  return mode.startsWith('cli:');
}

/** Helper to check if a ChatMode is a custom workflow mode */
export function isWorkflowMode(mode: ChatMode): mode is `wf:${string}` {
  return mode.startsWith('wf:');
}

/** Extract the provider ID from a CLI chat mode */
export function getCliProviderId(mode: ChatMode): CliProviderId | null {
  if (!mode.startsWith('cli:')) return null;
  return mode.slice(4) as CliProviderId;
}

/** Extract the workflow ID from a workflow chat mode */
export function getWorkflowId(mode: ChatMode): string | null {
  if (!mode.startsWith('wf:')) return null;
  return mode.slice(3);
}
