# Server Module — Architecture

## Overview

The `server/` module is the **cloud/enterprise entrypoint**. It exposes the same operations as the Electron main process, but over HTTP REST + WebSocket instead of IPC. This enables running flovia as a web application without Electron.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Express server setup, WebSocket, connector bootstrap, connector REST API, health check |
| `helpers.ts` | Shared route helpers: `ok()`, `fail()` response wrappers |
| `routes/index.ts` | Route aggregator — mounts all sub-routers |
| `routes/fs.routes.ts` | File system & git operations |
| `routes/ai.routes.ts` | AI chat completion (streaming and non-streaming) |
| `routes/session.routes.ts` | Session/folder management |
| `routes/history.routes.ts` | Chat history persistence |
| `routes/orchestrator.routes.ts` | Agent profiles & workflow CRUD, run execution |
| `routes/integrations.routes.ts` | Legacy connector-specific routes (GitHub, Supabase, Atlassian) |
| `routes/prompts.routes.ts` | Custom prompt settings |

## Key Patterns

- **Express + WebSocket**: REST for CRUD, WebSocket for streaming (AI chat, terminal)
- **Shared helpers**: `ok(res, data)` / `fail(res, err, status)` for consistent responses
- **Connector REST API**: Generic `/api/connectors/:id/actions/:actionId` endpoint

## Known Issues & TODOs

1. **No path traversal protection** — `fs.routes.ts` reads/writes arbitrary file paths from request body without validation
2. **Inconsistent error responses** — some routes return HTTP 200 with `{ success: false }`, others use `fail()` with proper status codes
3. **No rate limiting** — external API proxies (GitHub, Supabase) can be abused
4. **No authentication middleware** — placeholder comment exists but not implemented
5. **Duplicate bootstrap logic** — connector initialization is copy-pasted from `main/index.ts`
6. **Legacy integration routes** — should migrate to generic connector API
7. **SPA fallback after listen** — the catch-all route is defined after `server.listen()`, should be before
