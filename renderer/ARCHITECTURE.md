# Renderer Module — Architecture

## Overview

The `renderer/` module is the **React frontend** for flovia. It works in both Electron (via IPC) and web browser (via HTTP/WebSocket) modes, abstracted by the BackendContext.

## Directory Structure

```
renderer/src/
├── main.tsx                    # React entry point
├── App.tsx                     # Main layout (sidebar, editor, chat panels)
├── components/
│   ├── ui/                     # Shared primitives (Button, Input, Modal, Tabs, etc.)
│   ├── chat/                   # Chat components (ChatHeader, ChatMessages, ChatComposer, etc.)
│   ├── start/                  # Start page components (GitHubClone, WelcomeConnections)
│   ├── mui/                    # Material UI wrapper components (Panel, FormField, PluginCard)
│   ├── workflow/               # Workflow editor (WorkflowNode, NodePaletteDrawer, etc.)
│   ├── icons/                  # Custom icon components
│   └── *.tsx                   # Feature panels (ChatPanel, Sidebar, Editor, etc.)
├── hooks/                      # Custom React hooks
├── context/                    # React context providers
├── types/                      # TypeScript type definitions
├── utils/                      # Utility functions
├── backend/                    # Backend adapter layer (electron vs HTTP)
├── agents/                     # Default agent configuration
└── theme/                      # MUI theme configuration
```

## Key Patterns

- **BackendContext**: Single abstraction over Electron IPC vs HTTP REST
- **WorkspaceContext**: Central state for files, tabs, git, packages
- **AgentExecutionContext**: Agent config + trace state
- **StreamingBridgeContext**: Persists AI streaming across page transitions

## Component Size Guide

Components should generally stay under 300 lines. Current oversized components:

| Component | Lines | Recommended Split |
|-----------|-------|-------------------|
| AgentsPanel.tsx | 1352 | AgentBuilder, TraceViewer, AgentList |
| ChatPanel.tsx | 712 | ChatContainer, ChatModeSelector, ChatSettings |
| WorkflowEditor.tsx | 568 | WorkflowCanvas, ExecutionLog |
| ConnectorsPanel.tsx | 560 | ConnectorList, ConnectorConfig |
| McpServersPanel.tsx | 566 | ServerList, ServerInstaller, ToolInvoker |

## Known Issues & TODOs

1. **Duplicate barrel exports** — `types.ts` and `types/index.ts` export different subsets; consolidate
2. **Hardcoded UI constants** — resize limits, emoji icons, tab prefixes scattered across files
3. **No error boundaries** — async failures in components crash silently
4. **Inconsistent hook return types** — some use `Return` suffix, others use union types
5. **No shared notification system** — each component handles errors differently
6. **Tab opening pattern duplicated 6+ times** — needs a factory function
