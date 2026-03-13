# Main Module — Architecture

## Overview

The `main/` module contains the **Electron main process** code. It handles IPC communication between the renderer process and the backend services (file system, git, AI, terminal, connectors).

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Electron app entry point, window creation, connector bootstrap |
| `ipc.ts` | Legacy IPC handler registration |
| `ipc/` | Modular IPC handlers split by domain (ai, fs, session, history, etc.) |
| `fileSystem.ts` | File tree, git operations, text search |
| `ai.ts` | AI provider integrations (OpenAI, Anthropic, Ollama) |
| `terminal.ts` | Terminal PTY management via node-pty |
| `workspace.ts` | Folder opening, npm project detection |
| `chatHistory.ts` | Chat history persistence (per-workspace JSON files) |
| `sessionFolder.ts` | Per-session file management |
| `storage.ts` | Legacy key-value storage helpers |
| `github.ts` | **Deprecated** — backward-compat shim, re-exports from connectors/github |
| `atlassian.ts` | **Duplicate** — same types/functions as connectors/atlassian |
| `supabase.ts` | Supabase config detection helpers |
| `githubCli.ts` | GitHub CLI (gh) integration |
| `copilotCli.ts` | GitHub Copilot CLI integration |
| `cliProviders.ts` | Generic CLI provider system |
| `mcpServers.ts` | MCP (Model Context Protocol) server management |
| `prompts.ts` | Custom prompt persistence |
| `debugWindow.ts` | Debug window creation |
| `connectorIpc.ts` | IPC bridge for connector operations |

## Key Patterns

- **IPC Handlers**: Each `ipc/*.ipc.ts` file registers handlers for a specific domain
- **Sync Operations**: Git/file operations use `execSync` for simplicity (blocking but acceptable in Electron main process)

## Known Issues & TODOs

1. **fileSystem.ts is 500+ lines** — mixes git ops, file tree, and text search; should be split into 3 files
2. **Debug console.log spam** — `getGitChangedFilesSplit()` had 12+ debug logs (now cleaned up)
3. **Hardcoded Ollama URL** — `ai.ts` uses `localhost:11434` instead of env var
4. **Default shell fallback** — `terminal.ts` defaults to `/bin/zsh` instead of `/bin/bash` or `/bin/sh`
5. **Duplicate Atlassian code** — `atlassian.ts` duplicates types/functions from `connectors/atlassian/api.ts`
6. **Deprecated github.ts shim** — all importers should migrate to `connectors/github/api`
7. **ai.ts handles all providers** — should be split into per-provider files
