/**
 * GitHub Copilot CLI types
 * For the standalone `copilot` binary (not gh extension).
 */

export interface GhCliStatus {
  /** Whether the `copilot` CLI binary is on PATH */
  installed: boolean;
  /** Version string (e.g. "1.0.2") */
  version: string | null;
  /** Available model IDs from the CLI */
  models: string[];
  /** Error message if detection failed */
  error?: string;
}

export interface GhCopilotChatResult {
  success: boolean;
  response: string;
  error?: string;
}
