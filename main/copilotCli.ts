/**
 * GitHub Copilot CLI integration module
 *
 * Uses the standalone `copilot` CLI binary (not gh extension).
 * Supports detection, model listing, and streaming chat via `-p` non-interactive mode.
 *
 * Docs: https://docs.github.com/copilot/how-tos/copilot-cli
 */

import { execFile, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CopilotCliStatus {
  /** Whether the `copilot` binary is on PATH */
  installed: boolean;
  /** Version string (e.g. "1.0.2") */
  version: string | null;
  /** Available model IDs detected from the CLI */
  models: string[];
  /** Error message if detection failed */
  error?: string;
}

export interface CopilotCliChatResult {
  success: boolean;
  response: string;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip all ANSI escape codes (colors, cursor movement, etc.) from a string.
 */
function stripAnsi(text: string): string {
  // Matches all known ANSI escape sequences
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))/g, '');
}

/**
 * Extend PATH to include common install locations (Homebrew, etc.).
 */
function getExtendedPath(): string {
  const base = process.env.PATH || '';
  const extras = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/home/linuxbrew/.linuxbrew/bin',
    `${process.env.HOME}/.local/bin`,
    `${process.env.HOME}/go/bin`,
  ];
  return [...extras, base].join(':');
}

function copilotEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: getExtendedPath() };
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Detect the Copilot CLI binary, version, and available models.
 */
export async function detectCopilotCli(): Promise<CopilotCliStatus> {
  const status: CopilotCliStatus = {
    installed: false,
    version: null,
    models: [],
  };

  try {
    // Check if copilot is installed (fast — just runs --version)
    const { stdout: versionOut } = await execFileAsync('copilot', ['--version'], {
      timeout: 5000,
      env: copilotEnv(),
    });
    status.installed = true;
    // "GitHub Copilot CLI 1.0.2." → "1.0.2"
    const match = versionOut.match(/(\d+\.\d+\.\d+)/);
    if (match) status.version = match[1];

    // Use a known model list — avoids an expensive LLM call during detection
    status.models = [
      'claude-sonnet-4',
      'claude-sonnet-4.5',
      'gpt-4o',
      'gpt-4.1',
      'o4-mini',
      'gemini-2.5-pro',
    ];
  } catch (err: any) {
    status.error = err.message || '`copilot` CLI not found';
  }

  return status;
}

// ─── Non-interactive Chat ───────────────────────────────────────────────────

/**
 * Send a prompt to Copilot CLI in non-interactive mode and return the full response.
 */
export async function copilotChat(
  prompt: string,
  model?: string,
): Promise<CopilotCliChatResult> {
  try {
    const args = ['-p', prompt, '--allow-all-tools'];
    if (model) args.push('--model', model);

    const { stdout, stderr } = await execFileAsync('copilot', args, {
      timeout: 120000,
      env: copilotEnv(),
    });

    // Strip ANSI codes + usage stats
    const raw = stripAnsi(stdout.trim() || stderr.trim());
    const response = stripUsageStats(raw);
    if (!response) {
      return { success: false, response: '', error: 'No response from Copilot CLI' };
    }

    return { success: true, response };
  } catch (err: any) {
    return {
      success: false,
      response: '',
      error: err.message || 'Failed to run copilot CLI',
    };
  }
}

// ─── Streaming Chat ─────────────────────────────────────────────────────────

/**
 * Stream a Copilot CLI response. Calls `onChunk` as stdout data arrives.
 */
export function copilotChatStream(
  prompt: string,
  model: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): { abort: () => void } {
  const args = ['-p', prompt, '--allow-all-tools'];
  if (model) args.push('--model', model);

  const child: ChildProcess = spawn('copilot', args, {
    env: copilotEnv(),
  });

  let aborted = false;
  let buffer = '';

  /** Markers that indicate the start of the trailing usage-stats block. */
  const usageMarkers = [
    'Total usage est:',
    'API time spent:',
    'Total session time:',
    'Total code changes:',
    'Breakdown by AI model:',
  ];

  /**
   * Returns true if a line looks like part of the trailing usage block.
   */
  function isUsageLine(line: string): boolean {
    const t = line.trim();
    if (!t) return false;
    if (usageMarkers.some(m => t.startsWith(m))) return true;
    // Model-name stat lines that appear in the breakdown (e.g. "claude-sonnet-4  $0.02")
    if (/^\s*(claude|gpt|gemini|o\d|codex)/i.test(t) && /\$[\d.]/.test(t)) return true;
    return false;
  }

  child.stdout?.on('data', (data: Buffer) => {
    if (aborted) return;
    // Strip ANSI escape codes
    let text = stripAnsi(data.toString());

    // Filter out usage-stats lines from the chunk
    const lines = text.split('\n');
    const filtered = lines.filter(l => !isUsageLine(l));
    text = filtered.join('\n');

    if (text) {
      buffer += text;
      onChunk(text);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    // Some info comes through stderr — strip ANSI and forward
    if (!aborted) {
      const text = stripAnsi(data.toString());
      if (text.trim()) onChunk(text);
    }
  });

  child.on('close', (code) => {
    if (aborted) return;
    if (code === 0) {
      onDone();
    } else {
      onError(`copilot exited with code ${code}`);
    }
  });

  child.on('error', (err) => {
    if (!aborted) onError(err.message);
  });

  return {
    abort: () => {
      aborted = true;
      child.kill('SIGTERM');
    },
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Strip the trailing usage statistics block that the CLI appends.
 * Lines like "Total usage est:", "API time spent:", "Breakdown by AI model:" etc.
 */
function stripUsageStats(text: string): string {
  // Find the last blank line before stats section
  const statMarkers = [
    'Total usage est:',
    'API time spent:',
    'Total session time:',
    'Total code changes:',
    'Breakdown by AI model:',
  ];

  const lines = text.split('\n');
  let cutIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (statMarkers.some(m => trimmed.startsWith(m)) || /^\s*(claude|gpt|gemini|o\d)/i.test(trimmed)) {
      cutIndex = i;
    } else if (trimmed === '' && cutIndex < lines.length) {
      // blank line right before stats block — include it in the cut
      cutIndex = i;
      break;
    } else if (trimmed !== '') {
      break;
    }
  }

  return lines.slice(0, cutIndex).join('\n').trimEnd();
}
