# flovia

**AI-powered developer workspace — Desktop, Web & CLI**

Flovia is an open-source coding assistant that understands your codebase and makes intelligent changes. It combines a multi-agent pipeline with integrations for GitHub, Atlassian, Supabase, Gmail, and DigitalOcean — all in one workspace.

<!-- screenshot / demo GIF can be added here -->

## Features

- **Multi-agent pipeline** — Research → Plan → Edit → Verify, with configurable agent nodes and tools
- **Three interfaces** — Electron desktop app, browser-based web app, and a lightweight CLI
- **AI provider flexibility** — OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint
- **Built-in integrations** — GitHub, Atlassian Jira/Confluence, Supabase, DigitalOcean, Gmail
- **Code editing** — SEARCH/REPLACE block format for precise, reviewable diffs
- **Workspace-aware** — Reads your project tree, understands context, and generates commit messages
- **Extensible connectors** — Add new integrations by dropping in a single TypeScript file
- **MCP support** — Model Context Protocol servers for extended tool use

## Quick Start

### Desktop App

```bash
npx flovia
```

This downloads, installs, and launches the Electron app. Subsequent runs use the cached installation.

### Web App

```bash
git clone https://github.com/flovia-io/flovia.git
cd flovia
npm install
npm run web
```

Open [http://localhost:5173](http://localhost:5173). The React front-end proxies API calls to the Express server on port 3001.

### CLI

```bash
# Install globally
npm i -g @flovia-io/cli

# Or run directly
npx @flovia-io/cli ask "explain the auth flow"
```

The CLI shares settings with the desktop app — configure your AI provider once in the UI and use the same config everywhere.

#### CLI Usage

```
flovia-cli "explain the auth flow"
flovia-cli ask "what does this project do"
flovia-cli agent "add dark mode support"
flovia-cli agent -w ./my-project "refactor the utils folder"
echo "fix the bug" | flovia-cli agent
```

| Flag | Description |
|------|-------------|
| `-m, --mode` | `ask` (default), `agent`, or `chat` |
| `-w, --workspace` | Project directory (defaults to `.`) |
| `--model` | Override the model name |
| `--base-url` | Override the provider base URL |
| `--api-key` | Override the API key |

### Docker

```bash
# Build the image
docker build -t flovia .

# Run with local Ollama (macOS Docker Desktop)
docker run --rm -it \
  --add-host=host.docker.internal:host-gateway \
  -v $(pwd):/workspace \
  flovia agent -w /workspace \
    --base-url http://host.docker.internal:11434/v1 \
    --model gpt-oss:120b-cloud \
    "your prompt here"

# Run with OpenAI
docker run --rm -it \
  -e OPENAI_API_KEY="sk-..." \
  -v $(pwd):/workspace \
  flovia agent -w /workspace --base-url https://api.openai.com/v1 "your prompt"
```

## Development

### Prerequisites

- **Node.js** ≥ 18
- **npm** (comes with Node)
- **Git**
- **Python 3** with `setuptools` (needed by `node-gyp` for native modules)

### Setup

```bash
git clone https://github.com/flovia-io/flovia.git
cd flovia
npm install          # installs deps and rebuilds node-pty for Electron
```

### Run in Development

```bash
# Desktop (Electron + Vite hot-reload)
npm run dev

# Web (Vite + Express server with watch)
npm run web

# Server only
npm run server:dev

# CLI (quick invocations)
npm run ask -- "your question"
npm run agent -- "add tests for utils"
```

### Build

```bash
npm run build              # Full Electron build (main + renderer + package)
npm run build:main         # TypeScript → dist-main/
npm run build:cli          # TypeScript → dist-cli/
npm run build:server       # TypeScript → dist-server/

# Platform-specific desktop builds
npm run build:mac          # macOS DMG (universal: x64 + arm64)
npm run build:win          # Windows NSIS installer (x64)
npm run build:linux        # Linux AppImage (x64)
```

### Test

```bash
# Start the server, then run integration tests
npm run server &
npm run test:server
```

The test suite (`scripts/test-server.sh`) exercises REST endpoints for health, AI, prompts, chat history, file system, connectors, and integrations.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Interfaces                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Electron │  │ Web SPA  │  │ CLI              │  │
│  │ (IPC)    │  │ (HTTP/WS)│  │ (direct imports) │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼──────────┐ │
│  │                 Core Layer                      │ │
│  │  chat · connector · workflow-engine · storage   │ │
│  └────────────────────┬───────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐ │
│  │               Connectors                        │ │
│  │  GitHub · Atlassian · Supabase · DigitalOcean  │ │
│  │  Gmail · (your custom connector)               │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Agent Pipeline

When you send a coding request, the default agent pipeline runs:

1. **Triage** — classifies whether the request needs file changes or is just a question
2. **Research** — selects relevant files from the workspace to build context
3. **Chat Response** — streams an answer if no file changes are needed
4. **Action Planner** — decides which files to create, update, or delete
5. **Code Editor** — generates SEARCH/REPLACE blocks for each file
6. **File Writer** — applies edits to disk
7. **Verification** — checks if changes satisfy the request, retries if not
8. **Commit Message** — generates a conventional commit message

Agents are fully configurable in the UI — add, remove, or rewire pipeline nodes.

## Project Structure

```
flovia/
├── main/              # Electron main process + IPC handlers
├── renderer/          # React front-end (shared by desktop & web)
│   └── src/
│       ├── agents/    # Agent pipeline definitions
│       ├── components/# UI components (ChatPanel, Editor, FileTree, …)
│       ├── context/   # React context providers
│       ├── hooks/     # Custom React hooks
│       └── backend/   # Front-end API client
├── server/            # Express REST API + WebSocket (web/enterprise)
│   └── routes/        # API route handlers
├── core/              # Shared business logic (chat, connectors, storage)
├── connectors/        # Integration adapters (GitHub, Atlassian, …)
├── cli/               # Standalone CLI application
├── bin/               # npx launcher script
├── scripts/           # Build & test utilities
├── Dockerfile         # Multi-stage Docker image
├── vite.config.ts     # Vite config (React build + dev proxy)
├── tsconfig.json      # Root TypeScript config (path aliases)
└── package.json       # Dependencies & scripts
```

### Path Aliases

The TypeScript config defines these path aliases used throughout the codebase:

| Alias | Path |
|-------|------|
| `@flovia/core/*` | `./core/*` |
| `@flovia/connectors/*` | `./connectors/*` |
| `@flovia/main/*` | `./main/*` |

## Adding a Connector

1. Create `connectors/my-service.connector.ts` (see `_template.connector.ts`)
2. Export a `Connector` implementation
3. Import and add it to the `builtInConnectors` array in `connectors/index.ts`

The UI, IPC layer, and REST API pick it up automatically.

## Environment Variables

Create a `.env` file in the project root (not committed to git):

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `PORT` | Server port (default: `3001`) |
| `FLOVIA_DATA_DIR` | Data directory override (default: OS user data) |
| `FLOVIA_INSTALL_DIR` | Custom install directory for the launcher |

AI provider settings (model, base URL, API key) can also be configured in the desktop app's Settings panel and are shared with the CLI.

## CI/CD

GitHub Actions workflows are included:

- **Build & Release** (`build.yml`) — Builds macOS DMG, Windows EXE, and Linux AppImage on every push to `main` and version tags
- **Publish to npm** (`publish-npm.yml`) — Publishes `flovia` and `@flovia-io/cli` packages to npm on version tags

## License

[MIT](https://opensource.org/licenses/MIT)
