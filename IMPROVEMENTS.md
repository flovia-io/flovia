# Improvement Backlog

Prioritized list of improvements to address code quality, consistency, and maintainability.

## Priority 1 — Security & Correctness

### [SEC-01] Add path traversal protection to file routes
- **Where**: `server/routes/fs.routes.ts`, `main/fileSystem.ts`
- **Issue**: `req.body.filePath` is used unsanitized, allowing reads of arbitrary files (e.g. `../../etc/passwd`)
- **Fix**: Validate that `path.resolve(workspaceDir, filePath)` starts with `workspaceDir`

### [SEC-02] Sanitize git command inputs
- **Where**: `main/fileSystem.ts` (gitCommit, gitCheckout, gitCreateBranch)
- **Issue**: User-supplied branch names and commit messages are interpolated into shell commands
- **Fix**: Use `--` separator and proper escaping, or use a git library

### [SEC-03] Add authentication to server routes
- **Where**: `server/index.ts`
- **Issue**: All endpoints are publicly accessible
- **Fix**: Implement JWT/OAuth middleware for enterprise mode

## Priority 2 — Code Quality

### [QUAL-01] Remove duplicate Atlassian code
- **Where**: `main/atlassian.ts` duplicates `connectors/atlassian/api.ts`
- **Fix**: Delete `main/atlassian.ts`, update importers to use `connectors/atlassian/api`

### [QUAL-02] Remove deprecated github.ts shim
- **Where**: `main/github.ts`
- **Fix**: Update all importers to use `connectors/github/api`, delete shim

### [QUAL-03] Implement ConnectorOperations interface
- **Where**: `core/backend-adapter.ts`
- **Issue**: Interface is empty with `// ...existing code...` comment
- **Fix**: Define list, get, testConnection, executeAction, setConfig methods

### [QUAL-04] Fix inconsistent error handling in fs.routes.ts
- **Where**: `server/routes/fs.routes.ts`
- **Issue**: read-file and save-file return `200 { success: false }` instead of using `fail()`
- **Fix**: Use `fail(res, err)` consistently across all routes

### [QUAL-05] Consolidate duplicate type barrel exports
- **Where**: `renderer/src/types.ts` vs `renderer/src/types/index.ts`
- **Fix**: Keep only `types/index.ts`, update all imports from `./types` (non-directory)

## Priority 3 — Architecture

### [ARCH-01] Extract bootstrap logic into shared function
- **Where**: `server/index.ts` and `main/index.ts` both have identical connector bootstrap code
- **Fix**: Create `core/bootstrap.ts` with `bootstrapConnectors()` function

### [ARCH-02] Split fileSystem.ts into focused modules
- **Where**: `main/fileSystem.ts` (500+ lines)
- **Fix**: Split into `main/gitOps.ts`, `main/fileTree.ts`, `main/textSearch.ts`

### [ARCH-03] Split ai.ts by provider
- **Where**: `main/ai.ts` handles OpenAI + Anthropic + Ollama
- **Fix**: Create `main/ai/openai.ts`, `main/ai/anthropic.ts`, `main/ai/ollama.ts` with shared interface

### [ARCH-04] Split oversized frontend components
- **Where**: AgentsPanel (1352 lines), ChatPanel (712 lines)
- **Fix**: Follow component size guide in renderer/ARCHITECTURE.md

### [ARCH-05] Replace singletons with dependency injection
- **Where**: `core/` — getEventBus, getConnectorRegistry, getStorage, getRunManager
- **Fix**: Pass instances via constructor injection; remove global state

## Priority 4 — Developer Experience

### [DX-01] Add rate limiting to server API
- **Where**: `server/index.ts`
- **Fix**: Use `express-rate-limit` middleware on `/api/` routes

### [DX-02] Extract magic numbers to constants
- **Where**: Various files (event-bus maxHistory=2000, execution-run maxRuns=100, chat maxDisplay=303)
- **Fix**: Create `core/constants.ts` with named, configurable values

### [DX-03] Add proper error logging to EventBus
- **Where**: `core/event-bus.ts`
- **Issue**: All listener errors are silently swallowed
- **Fix**: Log errors in catch blocks

### [DX-04] Fix loadRuns() in execution-run.ts
- **Where**: `core/execution-run.ts`
- **Issue**: `loadRuns()` is a no-op — runs are lost on restart
- **Fix**: Implement deserialization from storage

### [DX-05] Fix default shell fallback
- **Where**: `main/terminal.ts`
- **Issue**: Falls back to `/bin/zsh` which isn't available on all systems
- **Fix**: Change to `/bin/bash` or `/bin/sh`
