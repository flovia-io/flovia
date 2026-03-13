// TODO(architecture): This file mixes git operations, file tree, and text search.
// Split into: gitOps.ts, fileTree.ts, textSearch.ts for better maintainability.
// TODO(security): Validate all incoming paths are within workspace boundaries.
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeEntry[];
}

const SKIP_DIRS = ['node_modules', '__pycache__', '.git'];

export function readDirectoryTree(dirPath: string): TreeEntry[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(e => !SKIP_DIRS.includes(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return { name: entry.name, path: fullPath, type: 'folder' as const, children: readDirectoryTree(fullPath) };
      }
      return { name: entry.name, path: fullPath, type: 'file' as const };
    });
}

export interface GitFileChange {
  file: string;
  status: string;
  staged: boolean;
}

export function getGitChangedFiles(folderPath: string): { file: string; status: string }[] {
  try {
    const out = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8' });
    return out.trim().split('\n').filter(Boolean).map(line => ({
      status: line.substring(0, 2).trim(),
      file: line.substring(3),
    }));
  } catch {
    return [];
  }
}

/**
 * Recursively list all files in a directory
 */
function listFilesRecursively(dirPath: string, basePath: string = ''): string[] {
  const result: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result.push(...listFilesRecursively(path.join(dirPath, entry.name), relativePath));
      } else {
        result.push(relativePath);
      }
    }
  } catch {
    // Directory not accessible
  }
  return result;
}

// TODO(cleanup): Excessive debug console.log statements were removed here.
// If verbose logging is needed, use a proper debug logger (e.g. `debug` npm package).
export function getGitChangedFilesSplit(folderPath: string): GitFileChange[] {
  try {
    const out = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const result: GitFileChange[] = [];
    // Don't trim() the full output — leading spaces are significant in porcelain format.
    const lines = out.replace(/\r/g, '').split('\n').filter(line => line.length > 0);

    for (const line of lines) {
      // git status --porcelain format: XY filename (X=index, Y=worktree)
      if (line.length < 4 || line[2] !== ' ') continue;

      const indexStatus = line[0];
      const wtStatus = line[1];
      const file = line.substring(3);

      // Staged change (index column has a letter, not space or ?)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        result.push({ file, status: indexStatus, staged: true });
      }
      // Unstaged / working tree change
      if (wtStatus !== ' ' && wtStatus !== undefined) {
        if (indexStatus === '?') {
          // Untracked: expand directories to individual files
          if (file.endsWith('/')) {
            const dirFullPath = path.join(folderPath, file);
            for (const subFile of listFilesRecursively(dirFullPath)) {
              result.push({ file: file + subFile, status: '??', staged: false });
            }
          } else {
            result.push({ file, status: '??', staged: false });
          }
        } else {
          result.push({ file, status: wtStatus, staged: false });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function gitStageFile(folderPath: string, filePath: string): void {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  execSync(`git add -- "${rel}"`, { cwd: folderPath });
}

export function gitUnstageFile(folderPath: string, filePath: string): void {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  execSync(`git reset HEAD -- "${rel}"`, { cwd: folderPath });
}

export function gitStageAll(folderPath: string): void {
  execSync('git add -A', { cwd: folderPath });
}

export function gitUnstageAll(folderPath: string): void {
  try {
    try {
      execSync('git rev-parse HEAD', { cwd: folderPath, stdio: ['pipe', 'pipe', 'pipe'] });
      execSync('git reset HEAD --quiet', { cwd: folderPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      // No commits yet, use git rm --cached for all staged files
      execSync('git rm --cached -r . --quiet 2>/dev/null || true', { cwd: folderPath, encoding: 'utf-8', shell: '/bin/bash' });
    }
    // TODO(perf): Remove this sleep — investigate if git index write is actually async
    execSync('sleep 0.05', { cwd: folderPath });
  } catch {
    // Unstage failures are non-critical
  }
}

export function gitDiscardFile(folderPath: string, filePath: string): { success: boolean; error?: string } {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  try {
    // Check if file is untracked
    const status = execSync(`git status --porcelain -- "${rel}"`, { cwd: folderPath, encoding: 'utf-8' }).trim();
    if (status.startsWith('??')) {
      // Untracked file - just delete it
      const fullPath = path.join(folderPath, rel);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } else {
      // Tracked file - checkout from HEAD
      execSync(`git checkout HEAD -- "${rel}"`, { cwd: folderPath });
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitCommit(folderPath: string, message: string): { success: boolean; error?: string } {
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: folderPath, encoding: 'utf-8' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

export function gitGetBranchInfo(folderPath: string): GitBranchInfo {
  const info: GitBranchInfo = { current: '', branches: [], ahead: 0, behind: 0, hasRemote: false };
  try {
    info.current = execSync('git rev-parse --abbrev-ref HEAD', { cwd: folderPath, encoding: 'utf-8' }).trim();
  } catch { return info; }

  try {
    const out = execSync('git branch --no-color', { cwd: folderPath, encoding: 'utf-8' });
    info.branches = out.trim().split('\n').map(b => b.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  } catch { /* ignore */ }

  try {
    const remote = execSync('git config --get branch.' + info.current + '.remote', { cwd: folderPath, encoding: 'utf-8' }).trim();
    info.hasRemote = !!remote;
  } catch { info.hasRemote = false; }

  if (info.hasRemote) {
    try {
      const out = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: folderPath, encoding: 'utf-8' }).trim();
      const [ahead, behind] = out.split(/\s+/).map(Number);
      info.ahead = ahead || 0;
      info.behind = behind || 0;
    } catch { /* no upstream tracking */ }
  }

  return info;
}

export function gitListBranches(folderPath: string): string[] {
  try {
    const out = execSync('git branch --no-color', { cwd: folderPath, encoding: 'utf-8' });
    return out.trim().split('\n').map(b => b.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function gitCheckout(folderPath: string, branch: string): { success: boolean; error?: string } {
  try {
    execSync(`git checkout "${branch}"`, { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitCreateBranch(folderPath: string, branch: string): { success: boolean; error?: string } {
  try {
    execSync(`git checkout -b "${branch}"`, { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitPull(folderPath: string): { success: boolean; output?: string; error?: string } {
  try {
    const out = execSync('git pull', { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, output: out.trim() };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitPush(folderPath: string): { success: boolean; output?: string; error?: string } {
  try {
    const out = execSync('git push', { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, output: out.trim() };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function getGitDiff(folderPath: string, filePath: string): { oldContent: string; newContent: string } {
  try {
    const rel = path.relative(folderPath, filePath);
    let oldContent = '';
    try {
      oldContent = execSync(`git show HEAD:${rel}`, { cwd: folderPath, encoding: 'utf-8' });
    } catch { /* new file */ }
    let newContent = '';
    try {
      newContent = fs.readFileSync(filePath, 'utf-8');
    } catch { /* deleted file */ }
    return { oldContent, newContent };
  } catch {
    return { oldContent: '', newContent: '' };
  }
}

export function getGitIgnoredPaths(folderPath: string): string[] {
  try {
    const out = execSync(
      'git ls-files --others --ignored --exclude-standard --directory',
      { cwd: folderPath, encoding: 'utf-8' }
    );
    return out.trim().split('\n').filter(Boolean).map(f => path.join(folderPath, f.replace(/\/$/, '')));
  } catch {
    return [];
  }
}

/**
 * Create a new file at the specified path
 */
export function createFile(filePath: string, content: string = ''): { success: boolean; error?: string } {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { success: false, error: 'File already exists' };
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Create a new folder at the specified path
 */
export function createFolder(folderPath: string): { success: boolean; error?: string } {
  try {
    // Check if folder already exists
    if (fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder already exists' };
    }
    
    fs.mkdirSync(folderPath, { recursive: true });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Delete a file or folder at the specified path
 */
export function deleteFileOrFolder(targetPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: 'Path does not exist' };
    }
    
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Rename a file or folder
 */
export function renameFileOrFolder(oldPath: string, newPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: 'Source path does not exist' };
    }
    
    if (fs.existsSync(newPath)) {
      return { success: false, error: 'Destination already exists' };
    }
    
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Text Search ──

export interface TextSearchMatch {
  file: string;       // relative path from folderPath
  line: number;       // 1-based line number
  column: number;     // 0-based column of the match
  text: string;       // the full line text (trimmed)
  matchLength: number;
}

export interface TextSearchResult {
  success: boolean;
  query: string;
  matches: TextSearchMatch[];
  truncated: boolean;
  error?: string;
}

/**
 * Search for a text pattern across all files in a workspace folder.
 * Uses `grep -rnI` for performance, with a max result limit.
 */
export function searchText(
  folderPath: string,
  query: string,
  options?: {
    caseSensitive?: boolean;
    maxResults?: number;
    includePattern?: string;   // glob, e.g. "*.ts"
    excludeDirs?: string[];
  },
): TextSearchResult {
  const maxResults = options?.maxResults ?? 200;
  const excludeDirs = options?.excludeDirs ?? ['node_modules', '.git', '__pycache__', 'dist', 'dist-main', '.next', 'build', 'coverage'];

  if (!query || !folderPath) {
    return { success: false, query, matches: [], truncated: false, error: 'Missing query or folder path' };
  }

  try {
    const excludeArgs = excludeDirs.map(d => `--exclude-dir=${d}`).join(' ');
    const caseFlag = options?.caseSensitive ? '' : '-i';
    const includeArg = options?.includePattern ? `--include="${options.includePattern}"` : '';

    // -r recursive, -n line numbers, -I skip binary files
    const cmd = `grep -rnI ${caseFlag} ${includeArg} ${excludeArgs} --max-count=50 -- ${JSON.stringify(query)} . | head -n ${maxResults}`;

    let output: string;
    try {
      output = execSync(cmd, {
        cwd: folderPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      });
    } catch (err: unknown) {
      // grep returns exit code 1 when no matches found — that's OK
      const execErr = err as { status?: number; stdout?: string };
      if (execErr.status === 1) {
        return { success: true, query, matches: [], truncated: false };
      }
      // If there IS stdout (exit code 2 = partial errors), still parse it
      if (execErr.stdout) {
        output = execErr.stdout;
      } else {
        return { success: false, query, matches: [], truncated: false, error: (err as Error).message };
      }
    }

    const lines = output.trim().split('\n').filter(Boolean);
    const truncated = lines.length >= maxResults;
    const matches: TextSearchMatch[] = [];

    for (const line of lines) {
      // Format: ./relative/path:lineNo:lineText
      const firstColon = line.indexOf(':');
      if (firstColon === -1) continue;
      const secondColon = line.indexOf(':', firstColon + 1);
      if (secondColon === -1) continue;

      let filePart = line.slice(0, firstColon);
      if (filePart.startsWith('./')) filePart = filePart.slice(2);
      const lineNum = parseInt(line.slice(firstColon + 1, secondColon), 10);
      const lineText = line.slice(secondColon + 1);

      if (isNaN(lineNum)) continue;

      const lowerLine = options?.caseSensitive ? lineText : lineText.toLowerCase();
      const lowerQuery = options?.caseSensitive ? query : query.toLowerCase();
      const col = lowerLine.indexOf(lowerQuery);

      matches.push({
        file: filePart,
        line: lineNum,
        column: col >= 0 ? col : 0,
        text: lineText.trim().slice(0, 300),
        matchLength: query.length,
      });
    }

    return { success: true, query, matches, truncated };
  } catch (err: unknown) {
    return { success: false, query, matches: [], truncated: false, error: (err as Error).message };
  }
}
