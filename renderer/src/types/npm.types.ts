/**
 * NPM project related types
 */

export interface NpmProject {
  name: string;
  relativePath: string;
  absolutePath: string;
  scripts: Record<string, string>;
}
