/**
 * Workspace operations — shared by IPC and server routes.
 * Consolidates open-folder, npm-project scanning, and workspace metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readDirectoryTree, getGitIgnoredPaths } from './fileSystem';

export interface WorkspaceInfo {
  folderPath: string;
  tree: ReturnType<typeof readDirectoryTree>;
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  gitIgnoredPaths: string[];
}

export interface NpmProject {
  name: string;
  relativePath: string;
  absolutePath: string;
  scripts: Record<string, string>;
}

/**
 * Open a folder and return workspace metadata.
 * Used by both `ipc.ts` (Electron) and `server/routes.ts` (web).
 */
export function openFolder(folderPath: string): WorkspaceInfo | null {
  if (!fs.existsSync(folderPath)) return null;

  const tree = readDirectoryTree(folderPath);
  const hasGit = fs.existsSync(path.join(folderPath, '.git'));
  const pkgPath = path.join(folderPath, 'package.json');
  const hasPackageJson = fs.existsSync(pkgPath);

  let packageName: string | null = null;
  if (hasPackageJson) {
    try {
      packageName = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).name ?? null;
    } catch { /* ignore */ }
  }

  const gitIgnoredPaths = hasGit ? getGitIgnoredPaths(folderPath) : [];

  return { folderPath, tree, hasGit, hasPackageJson, packageName, gitIgnoredPaths };
}

/**
 * Recursively find all `package.json` files with scripts in a workspace.
 * Used by both `ipc.ts` (Electron) and `server/routes.ts` (web).
 */
export function findNpmProjects(folderPath: string, gitIgnoredPaths: string[] = []): NpmProject[] {
  const projects: NpmProject[] = [];
  const ignoredSet = new Set(gitIgnoredPaths.map(p => path.resolve(folderPath, p)));

  function isIgnored(filePath: string): boolean {
    let current = filePath;
    while (current !== folderPath && current !== path.dirname(current)) {
      if (ignoredSet.has(current)) return true;
      current = path.dirname(current);
    }
    return false;
  }

  function walkDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
          if (isIgnored(fullPath)) continue;
          walkDir(fullPath);
        } else if (entry.name === 'package.json') {
          if (isIgnored(fullPath)) continue;
          try {
            const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            const scripts = pkg.scripts ?? {};
            if (Object.keys(scripts).length > 0) {
              const relativePath = path.relative(folderPath, path.dirname(fullPath)) || '.';
              projects.push({
                name: pkg.name || relativePath,
                relativePath,
                absolutePath: path.dirname(fullPath),
                scripts,
              });
            }
          } catch { /* ignore invalid package.json */ }
        }
      }
    } catch { /* ignore unreadable directories */ }
  }

  walkDir(folderPath);
  return projects;
}
