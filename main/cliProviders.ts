/**
 * CLI Providers — generic backend for external CLI-based AI tools.
 *
 * Provides a uniform interface for detection, chat, and streaming across
 * CLI providers.
 *
 * To add a new provider:
 * 1. Add its id and metadata to `core/cliProvider.ts`
 * 2. Add a `buildChatArgs` case in this file
 * 3. That's it — detection, streaming, and ANSI/stats stripping are generic.
 */

import { execFile, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import {
  CLI_PROVIDERS,
  type CliProviderId,
  type CliProviderStatus,
  type CliChatResult,
} from '@flovia/core/cliProvider';

const execFileAsync = promisify(execFile);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip all ANSI escape codes (colors, cursor movement, etc.) from a string.
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))/g, '');
}

/** Extend PATH to include common install locations (Homebrew, etc.). */
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

function extendedEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: getExtendedPath() };
}

/** Usage-stat markers — these lines are stripped from streaming output. */
const USAGE_MARKERS = [
  'Total usage est:',
  'API time spent:',
  'Total session time:',
  'Total code changes:',
  'Breakdown by AI model:',
];

function isUsageLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (USAGE_MARKERS.some(m => t.startsWith(m))) return true;
  if (/^\s*(claude|gpt|gemini|o\d|codex)/i.test(t) && /\$[\d.]/.test(t)) return true;
  return false;
}

function stripUsageStats(text: string): string {
  const lines = text.split('\n');
  let cutIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (USAGE_MARKERS.some(m => trimmed.startsWith(m)) || /^\s*(claude|gpt|gemini|o\d)/i.test(trimmed)) {
      cutIndex = i;
    } else if (trimmed === '' && cutIndex < lines.length) {
      cutIndex = i;
      break;
    } else if (trimmed !== '') {
      break;
    }
  }

  return lines.slice(0, cutIndex).join('\n').trimEnd();
}

// ─── Per-provider argument builders ─────────────────────────────────────────

/**
 * Build the CLI arguments for a non-interactive chat prompt.
 * Each provider has its own flag conventions.
 */
function buildChatArgs(providerId: CliProviderId, prompt: string, model?: string): string[] {
  switch (providerId) {
    case 'copilot': {
      const args = ['-p', prompt, '--allow-all-tools'];
      if (model) args.push('--model', model);
      return args;
    }
    default:
      return ['-p', prompt];
  }
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Detect a CLI provider — checks if the binary is on PATH and reads its version.
 * Uses the static model list from `CLI_PROVIDERS` (no expensive LLM calls).
 */
export async function detectCliProvider(providerId: CliProviderId): Promise<CliProviderStatus> {
  const meta = CLI_PROVIDERS[providerId];
  if (!meta) {
    return { providerId, installed: false, version: null, models: [], error: `Unknown provider: ${providerId}` };
  }

  const status: CliProviderStatus = {
    providerId,
    installed: false,
    version: null,
    models: [],
  };

  try {
    const { stdout } = await execFileAsync(meta.binary, ['--version'], {
      timeout: 5000,
      env: extendedEnv(),
    });
    status.installed = true;

    const match = stdout.match(/(\d+\.\d+\.\d+)/);
    if (match) status.version = match[1];

    // Use known model list — fast, no API call
    status.models = [...meta.defaultModels];
  } catch (err: any) {
    status.error = err.message || `\`${meta.binary}\` not found on PATH`;
  }

  return status;
}

/**
 * Detect all known CLI providers in parallel.
 */
export async function detectAllCliProviders(): Promise<CliProviderStatus[]> {
  const ids = Object.keys(CLI_PROVIDERS) as CliProviderId[];
  return Promise.all(ids.map(id => detectCliProvider(id)));
}

// ─── Non-interactive Chat ───────────────────────────────────────────────────

export async function cliChat(
  providerId: CliProviderId,
  prompt: string,
  model?: string,
): Promise<CliChatResult> {
  const meta = CLI_PROVIDERS[providerId];
  if (!meta) return { success: false, response: '', error: `Unknown provider: ${providerId}` };

  try {
    const args = buildChatArgs(providerId, prompt, model);
    const { stdout, stderr } = await execFileAsync(meta.binary, args, {
      timeout: 120000,
      env: extendedEnv(),
    });

    const raw = stripAnsi(stdout.trim() || stderr.trim());
    const response = stripUsageStats(raw);
    if (!response) {
      return { success: false, response: '', error: `No response from ${meta.name}` };
    }

    return { success: true, response };
  } catch (err: any) {
    return { success: false, response: '', error: err.message || `Failed to run ${meta.binary}` };
  }
}

// ─── Streaming Chat ─────────────────────────────────────────────────────────

export function cliChatStream(
  providerId: CliProviderId,
  prompt: string,
  model: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): { abort: () => void } {
  const meta = CLI_PROVIDERS[providerId];
  if (!meta) {
    onError(`Unknown provider: ${providerId}`);
    return { abort: () => {} };
  }

  const args = buildChatArgs(providerId, prompt, model);
  const child: ChildProcess = spawn(meta.binary, args, { env: extendedEnv() });

  let aborted = false;
  let buffer = '';

  child.stdout?.on('data', (data: Buffer) => {
    if (aborted) return;
    let text = stripAnsi(data.toString());

    const lines = text.split('\n');
    const filtered = lines.filter(l => !isUsageLine(l));
    text = filtered.join('\n');

    if (text) {
      buffer += text;
      onChunk(text);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    if (!aborted) {
      const text = stripAnsi(data.toString());
      if (text.trim()) onChunk(text);
    }
  });

  child.on('close', (code) => {
    if (aborted) return;
    if (code === 0) onDone();
    else onError(`${meta.binary} exited with code ${code}`);
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
