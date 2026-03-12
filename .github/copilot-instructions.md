# Copilot Instructions for flovia

## Project Overview

Flovia is an AI-powered developer workspace available as an Electron desktop app, a browser-based web app, and a CLI. It uses a multi-agent pipeline (research → plan → edit → verify) to understand codebases and make intelligent changes, with connectors for GitHub, Atlassian, Supabase, DigitalOcean, and Gmail.

## Tech Stack

- **Language:** TypeScript 5.9, compiled to CommonJS/ES2020
- **Frontend:** React 19, Material-UI (MUI) 7, Emotion, Vite 6
- **Desktop:** Electron 33 with `node-pty` for terminal emulation
- **Backend:** Express.js 5, WebSocket (`ws`)
- **AI SDKs:** `openai` 6.x, `@anthropic-ai/sdk` 0.78.x
- **Runtime:** Node.js ≥ 18

## Repository Layout

```
main/           → Electron main process + IPC handlers
renderer/src/   → React UI (components, context, hooks, agents)
server/         → Express REST API + WebSocket routes
core/           → Shared logic (chat, connectors, storage, events)
connectors/     → Integration adapters (GitHub, Atlassian, Supabase, DigitalOcean, Gmail)
cli/            → Standalone CLI application
bin/            → npx launcher script
scripts/        → Build and test utilities
```

## Path Aliases

The TypeScript config defines these aliases — use them for all imports:

```
@flovia/core/*        → ./core/*
@flovia/connectors/*  → ./connectors/*
@flovia/main/*        → ./main/*
```

In the renderer, `@/` maps to `renderer/src/`.

## Build & Run Commands

```bash
npm install                # Install dependencies (rebuilds node-pty for Electron)

# Development
npm run dev                # Desktop: Electron + Vite hot-reload
npm run web                # Web: Vite + Express with watch
npm run server:dev         # Server only (tsx watch)

# Build
npm run build:main         # TypeScript → dist-main/  (main + core + connectors)
npm run build:cli          # TypeScript → dist-cli/
npm run build:server       # TypeScript → dist-server/
npm run build              # Full Electron build (main + renderer + electron-builder)

# Test
npm run test:server        # Bash integration tests against REST endpoints
```

## Coding Conventions

- Use the `@flovia/core`, `@flovia/connectors`, and `@flovia/main` path aliases for cross-module imports — never use relative paths across module boundaries.
- Frontend components live in `renderer/src/components/` and use Material-UI (`@mui/material`).
- React context providers are in `renderer/src/context/` — see `BackendContext`, `WorkspaceContext`, and `AgentExecutionContext`.
- IPC handlers follow the pattern `main/ipc/<domain>.ipc.ts` and register channels in `main/index.ts`.
- Server routes follow the pattern `server/routes/<domain>.routes.ts` and are aggregated in `server/routes/index.ts`.
- Connectors implement the `Connector` interface from `@flovia/core/connector` and are registered in `connectors/index.ts`.
- Agent pipeline nodes are defined in `renderer/src/agents/defaultAgent.ts` — each node has an id, category, optional promptKey, inputs, outputs, and tools.
- SEARCH/REPLACE block format is used for code edits — parsed by `parseSearchReplaceBlocks()` and applied by `applySearchReplaceBlocks()` in `core/chat.ts`.
- Keep `express.json()` body limit at `50mb` for large file payloads.
- TypeScript strict mode is enabled in all tsconfig files.

## Testing

There is no unit test framework. Testing is done via bash integration tests in `scripts/test-server.sh` which exercise REST endpoints using `curl`. To run:

```bash
# Start the server first
npm run server &
npm run test:server
```

When adding new server routes, add corresponding `check` calls to `scripts/test-server.sh`.

## Adding a New Connector

1. Copy `connectors/_template.connector.ts` → `connectors/my-service.connector.ts`
2. Implement the `Connector` interface
3. Add the connector to the `builtInConnectors` array in `connectors/index.ts`

The connector will be automatically available in the UI, IPC layer, and REST API.

## Adding a New Server Route

1. Create `server/routes/<domain>.routes.ts`
2. Export an Express `Router`
3. Import and mount it in `server/routes/index.ts`

## Key Types

- `ChatMessage` — `{ role, content, displayText }` in `core/chat.ts`
- `FileActionPlan` — `{ file, action, description }` in `core/chat.ts`
- `Connector` / `ConnectorMetadata` — in `core/connector.ts`
- `AgentConfig` / `AgentNode` / `AgentEdge` — in `renderer/src/types/agent.types.ts`
