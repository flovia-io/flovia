/**
 * Session folder management for web/Docker mode.
 * Creates unique session folders in the cache directory for:
 * 1. Quick chat sessions without a workspace
 * 2. GitHub clone operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getUserDataDir } from '@flovia/core/dataDir';

/** Git clone timeout in milliseconds (2 minutes for large repositories) */
const GIT_CLONE_TIMEOUT_MS = 2 * 60 * 1000;

export interface SessionFolderResult {
  success: boolean;
  folderPath?: string;
  folderName?: string;
  error?: string;
}

export interface GitCloneResult {
  success: boolean;
  folderPath?: string;
  folderName?: string;
  error?: string;
}

/**
 * Get the sessions directory path
 */
function getSessionsDir(): string {
  return path.join(getUserDataDir(), '_cache', 'sessions');
}

/**
 * Ensure the sessions directory exists
 */
function ensureSessionsDir(): void {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a unique session folder name based on timestamp and optional title
 */
function generateSessionName(title?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sanitizedTitle = title
    ? title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30)
    : 'session';
  return `${timestamp}-${sanitizedTitle}`;
}

/**
 * Create a new session folder with a unique name
 * Used when user starts chatting without a workspace
 */
export function createSessionFolder(title?: string): SessionFolderResult {
  try {
    ensureSessionsDir();
    
    const folderName = generateSessionName(title);
    const folderPath = path.join(getSessionsDir(), folderName);
    
    // Create the folder
    fs.mkdirSync(folderPath, { recursive: true });
    
    // Create a basic README to mark it as a session folder
    const readme = `# Session: ${title || 'New Session'}

This workspace was created automatically for a chat session.
Created at: ${new Date().toISOString()}
`;
    fs.writeFileSync(path.join(folderPath, 'README.md'), readme, 'utf-8');
    
    return {
      success: true,
      folderPath,
      folderName,
    };
  } catch (err) {
    console.error('[SessionFolder] Failed to create session folder:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Clone a GitHub repository into a new session folder
 */
export async function cloneGitHubRepo(
  repoUrl: string,
  token?: string
): Promise<GitCloneResult> {
  try {
    ensureSessionsDir();
    
    // Extract repo name from URL
    const repoName = extractRepoName(repoUrl);
    if (!repoName) {
      return { success: false, error: 'Invalid repository URL' };
    }
    
    const folderName = generateSessionName(repoName);
    const folderPath = path.join(getSessionsDir(), folderName);
    
    // Prepare the clone URL with auth if token provided
    let cloneUrl = repoUrl;
    if (token) {
      // For HTTPS URLs, embed the token
      if (repoUrl.startsWith('https://')) {
        cloneUrl = repoUrl.replace('https://', `https://oauth2:${token}@`);
      }
    }
    
    // Clone the repository
    try {
      execSync(`git clone "${cloneUrl}" "${folderPath}"`, {
        encoding: 'utf-8',
        timeout: GIT_CLONE_TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (cloneErr: any) {
      const errorMsg = cloneErr.stderr || cloneErr.message;
      // Clean up partial clone
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
      return {
        success: false,
        error: `Failed to clone repository: ${errorMsg}`,
      };
    }
    
    return {
      success: true,
      folderPath,
      folderName: repoName,
    };
  } catch (err) {
    console.error('[SessionFolder] Failed to clone repository:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Extract repository name from a GitHub URL
 */
function extractRepoName(url: string): string | null {
  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/);
  if (sshMatch) {
    return sshMatch[2];
  }
  
  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch) {
    return httpsMatch[2];
  }
  
  return null;
}

/**
 * List all session folders
 */
export function listSessionFolders(): { folderPath: string; folderName: string; createdAt: string }[] {
  try {
    ensureSessionsDir();
    const sessionsDir = getSessionsDir();
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    
    return entries
      .filter(e => e.isDirectory())
      .map(e => {
        const folderPath = path.join(sessionsDir, e.name);
        const stat = fs.statSync(folderPath);
        return {
          folderPath,
          folderName: e.name,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('[SessionFolder] Failed to list session folders:', err);
    return [];
  }
}

/**
 * Delete a session folder
 */
export function deleteSessionFolder(folderPath: string): { success: boolean; error?: string } {
  try {
    const sessionsDir = getSessionsDir();
    // Security check: only allow deleting from sessions directory
    if (!folderPath.startsWith(sessionsDir)) {
      return { success: false, error: 'Cannot delete folders outside of sessions directory' };
    }
    
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
    
    return { success: true };
  } catch (err) {
    console.error('[SessionFolder] Failed to delete session folder:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
