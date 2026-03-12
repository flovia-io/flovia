/**
 * CLI Provider types — re-exports from core + renderer-specific additions.
 *
 * Currently supported: GitHub Copilot CLI
 *
 * Each CLI provider implements the same interface so the UI can treat them
 * uniformly — same model dropdown, same streaming, same terminal-style output.
 *
 * To add a new CLI provider, update `core/cliProvider.ts`.
 */

export type {
  CliProviderId,
  CliProviderMeta,
  CliProviderStatus,
  CliChatResult,
} from '../../../core/cliProvider';

export { CLI_PROVIDERS } from '../../../core/cliProvider';

