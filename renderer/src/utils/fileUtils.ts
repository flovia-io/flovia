/**
 * File icon mapping based on extension
 */
const FILE_ICON_MAP: Record<string, string> = {
  ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋', css: '🎨', html: '🌐',
  md: '📝', py: '🐍', rs: '🦀', go: '🐹', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
  sh: '🖥', bash: '🖥', zsh: '🖥', txt: '📄', svg: '🖼', png: '🖼', jpg: '🖼',
  jpeg: '🖼', gif: '🖼', webp: '🖼', ico: '🖼', vue: '💚', svelte: '🧡',
  rb: '💎', php: '🐘', java: '☕', kt: '🟣', swift: '🍎', c: '🔷', cpp: '🔷',
  h: '🔷', hpp: '🔷', cs: '🟪', sql: '🗄', graphql: '🔺', gql: '🔺',
  dockerfile: '🐳', docker: '🐳', env: '🔐', gitignore: '📜', lock: '🔒',
};

/**
 * Get emoji icon for a file based on its extension
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICON_MAP[ext] ?? '📄';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Get language from file extension (for syntax highlighting hints)
 */
export function getLanguageFromExtension(filename: string): string {
  const ext = getFileExtension(filename);
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python',
    rs: 'rust', go: 'go', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', graphql: 'graphql',
    rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin', swift: 'swift',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  };
  return langMap[ext] ?? 'plaintext';
}

/**
 * Get relative path from absolute path given a base folder
 */
export function getRelativePath(absolutePath: string, basePath: string): string {
  if (absolutePath.startsWith(basePath)) {
    return absolutePath.slice(basePath.length + 1);
  }
  return absolutePath;
}

/**
 * Get filename from path
 */
export function getFilename(path: string): string {
  return path.split('/').pop() ?? path;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
