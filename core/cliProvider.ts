/**
 * CLI Provider — core types & metadata registry.
 *
 * Shared between main process and renderer. Contains only type definitions
 * and static metadata — no Electron or Node.js imports.
 *
 * To add a new CLI provider:
 * 1. Add its id to `CliProviderId`
 * 2. Add a `CliProviderMeta` entry to `CLI_PROVIDERS`
 * 3. Implement detect/chat/stream in `main/cliProviders.ts`
 */

// ─── Provider ID ────────────────────────────────────────────────────────────

/** Unique identifier for a CLI provider. Add new IDs here when adding providers. */
export type CliProviderId = 'copilot';

// ─── Metadata ───────────────────────────────────────────────────────────────

export interface CliProviderMeta {
  id: CliProviderId;
  name: string;
  shortName: string;
  icon: string;
  binary: string;
  docsUrl: string;
  installCommands: { manager: string; command: string }[];
  /** Known model IDs (used as fallback when the CLI can't list them) */
  defaultModels: string[];
}

/** Static registry — add new providers here */
export const CLI_PROVIDERS: Record<CliProviderId, CliProviderMeta> = {
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    shortName: 'Copilot',
    icon: '✦',
    binary: 'copilot',
    docsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
    installCommands: [
      { manager: 'npm', command: 'npm install -g @githubnext/github-copilot-cli' },
      { manager: 'brew', command: 'brew install github/gh/copilot' },
    ],
    defaultModels: [
      'claude-sonnet-4',
      'claude-sonnet-4.5',
      'gpt-4o',
      'gpt-4.1',
      'o4-mini',
      'gemini-2.5-pro',
    ],
  },
};

// ─── Runtime types ──────────────────────────────────────────────────────────

/** Runtime status returned by detection */
export interface CliProviderStatus {
  providerId: CliProviderId;
  installed: boolean;
  version: string | null;
  models: string[];
  error?: string;
}

/** Result of a non-streaming chat call */
export interface CliChatResult {
  success: boolean;
  response: string;
  error?: string;
}
