# Core Module — Architecture

## Overview

The `core/` module is the **domain layer** of the flovia application. It follows hexagonal (ports & adapters) architecture principles — no transport dependencies, no Electron/browser/Express code.

## Files

| File | Purpose |
|------|---------|
| `orchestrator.ts` | Domain types: Workflow, Step, Artifact, AgentProfile, and port interfaces (OrchestratorStorage, LlmPort, WorkspaceToolPort) |
| `connector.ts` | Connector plugin system: Connector interface, ConnectorRegistry, and event types |
| `connector-bootstrap.ts` | Restores persisted connector configs/states on startup |
| `event-bus.ts` | Cross-cutting event system for workflow/step/trace lifecycle events |
| `execution-run.ts` | Wraps WorkflowEngine with EventBus for full run observability |
| `workflow-engine.ts` | DAG-based workflow executor — resolves dependencies, runs steps in parallel |
| `workflow-editor.types.ts` | UI-specific workflow editor types (visual positions, node/edge shapes) |
| `storage.ts` | StoragePort interface + FileStorageAdapter implementation |
| `chat.ts` | Shared AI chat logic: prompt builders, SEARCH/REPLACE parsers, verification |
| `backend-adapter.ts` | BackendAdapter interface decoupling renderer from transport |
| `dataDir.ts` | Platform-specific user data directory resolution |
| `utils.ts` | Shared utilities (ID generation, array helpers) |

## Key Patterns

- **Ports**: `OrchestratorStorage`, `LlmPort`, `WorkspaceToolPort`, `StoragePort` — interfaces that adapters implement
- **Singletons**: `getEventBus()`, `getConnectorRegistry()`, `getStorage()`, `getRunManager()` — global instances with reset functions for testing
- **Events**: All lifecycle activity flows through the EventBus for UI observability

## Known Issues & TODOs

1. **ConnectorOperations interface is empty** — `backend-adapter.ts` has a stub interface that needs implementation
2. **FileStorageAdapter lives in storage.ts** — should be separated from the port interface per hexagonal architecture
3. **Singletons over DI** — makes testing difficult; consider constructor injection
4. **chat.ts is 550+ lines** — mixes prompt builders, parsers, and SEARCH/REPLACE utils; consider splitting
5. **execution-run.ts loadRuns() is a no-op** — runs are lost on restart
6. **Magic numbers** — maxHistory=2000, maxRuns=100, maxDisplay=303 should be configurable constants
