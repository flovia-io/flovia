/**
 * GitHub CLI (gh) integration module
 * Detects `gh` CLI installation and Copilot extension.
 * Provides chat-with-copilot functionality via `gh copilot suggest/explain`.
 */

import { execFile, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GhCliStatus {
  /** Whether `gh` CLI is installed and available on PATH */
  installed: boolean;
  /** The version string if installed (e.g. "2.42.0") */
  version: string | null;
  /** Whether the user is authenticated (`gh auth status`) */
  authenticated: boolean;
  /** Whether `gh copilot` extension is installed */
  copilotExtension: boolean;
  /** Error message if detection failed */
  error?: string;
}

export interface GhCopilotChatResult {
  success: boolean;
  response: string;
  error?: string;
}

/**
 * Detect GitHub CLI installation, auth, and Copilot extension status.
 */
export async function detectGhCli(): Promise<GhCliStatus> {
  const status: GhCliStatus = {
    installed: false,
    version: null,
    authenticated: false,
    copilotExtension: false,
  };

  try {
    // Check if gh is installed
    const { stdout: versionOut } = await execFileAsync('gh', ['--version'], {
      timeout: 5000,
      env: { ...process.env, PATH: getExtendedPath() },
    });
    status.installed = true;
    const match = versionOut.match(/gh version (\S+)/);
    if (match) status.version = match[1];

    // Check auth status
    try {
      await execFileAsync('gh', ['auth', 'status'], {
        timeout: 5000,
        env: { ...process.env, PATH: getExtendedPath() },
      });
      status.authenticated = true;
    } catch {
      status.authenticated = false;
    }

    // Check copilot extension
    try {
      const { stdout: extOut } = await execFileAsync('gh', ['extension', 'list'], {
        timeout: 5000,
        env: { ...process.env, PATH: getExtendedPath() },
      });
      status.copilotExtension = extOut.toLowerCase().includes('copilot');
    } catch {
      status.copilotExtension = false;
    }
  } catch (err: any) {
    status.error = err.message || 'gh CLI not found';
  }

  return status;
}

/**
 * Install the GitHub Copilot CLI extension.
 */
export async function installCopilotExtension(): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync('gh', ['extension', 'install', 'github/gh-copilot'], {
      timeout: 60000,
      env: { ...process.env, PATH: getExtendedPath() },
    });
    return { success: true };
  } catch (err: any) {
    // It might already be installed — try upgrade instead
    try {
      await execFileAsync('gh', ['extension', 'upgrade', 'gh-copilot'], {
        timeout: 60000,
        env: { ...process.env, PATH: getExtendedPath() },
      });
      return { success: true };
    } catch (upgradeErr: any) {
      return { success: false, error: err.message || 'Failed to install gh-copilot extension' };
    }
  }
}

/**
 * Chat with GitHub Copilot via `gh copilot suggest` or `gh copilot explain`.
 * Uses `suggest` for general prompts, `explain` for explanation requests.
 */
export async function chatWithCopilot(prompt: string): Promise<GhCopilotChatResult> {
  try {
    // Use `gh copilot explain` for the prompt — it's the most conversational command
    const { stdout, stderr } = await execFileAsync(
      'gh',
      ['copilot', 'explain', prompt],
      {
        timeout: 60000,
        env: {
          ...process.env,
          PATH: getExtendedPath(),
          // Force non-interactive mode
          GH_PROMPT_DISABLED: '1',
        },
      },
    );

    const response = stdout.trim() || stderr.trim();
    if (!response) {
      return { success: false, response: '', error: 'No response from Copilot' };
    }

    return { success: true, response };
  } catch (err: any) {
    return {
      success: false,
      response: '',
      error: err.message || 'Failed to communicate with GitHub Copilot',
    };
  }
}

/**
 * Stream a Copilot chat response. Calls the onChunk callback as data arrives.
 */
export function chatWithCopilotStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): { abort: () => void } {
  const child: ChildProcess = spawn(
    'gh',
    ['copilot', 'explain', prompt],
    {
      env: {
        ...process.env,
        PATH: getExtendedPath(),
        GH_PROMPT_DISABLED: '1',
      },
    },
  );

  let aborted = false;

  child.stdout?.on('data', (data: Buffer) => {
    if (!aborted) onChunk(data.toString());
  });

  child.stderr?.on('data', (data: Buffer) => {
    // Some useful output comes through stderr
    if (!aborted) onChunk(data.toString());
  });

  child.on('close', (code) => {
    if (!aborted) {
      if (code === 0) {
        onDone();
      } else {
        onError(`gh copilot exited with code ${code}`);
      }
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

/**
 * Extend PATH to include common install locations for `gh` on macOS/Linux.
 */
function getExtendedPath(): string {
  const base = process.env.PATH || '';
  const extras = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/home/linuxbrew/.linuxbrew/bin',
    `${process.env.HOME}/.local/bin`,
    `${process.env.HOME}/go/bin`,
  ];
  return [...extras, base].join(':');
}
