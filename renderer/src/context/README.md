# renderer/src/context/

React context providers that supply global state and services to the component tree.

## Providers

### `BackendContext.tsx`

Provides the `BackendAPI` instance to all components.

```tsx
// Wraps the app in main.tsx:
<BackendProvider>
  <App />
</BackendProvider>

// Used in any component:
const backend = useBackend();
await backend.readFile(path);
```

**Exports:**
| Export | Description |
|--------|-------------|
| `BackendProvider` | Context provider — call `getBackend()` once, memoize |
| `useBackend()` | Hook — returns the `BackendAPI` instance |
| `useBackendMode()` | Hook — returns `'electron'` or `'web'` |

### `WorkspaceContext.tsx`

Manages all workspace state — folder path, file tree, open tabs, git status, npm projects, Supabase config. All file/git/tab operations go through this context.

```tsx
// Wraps the app in App.tsx:
<WorkspaceProvider>
  <AppLayout />
</WorkspaceProvider>

// Used in any component:
const { folderPath, tree, openTabs, activeTabPath, openFile, saveFile } = useWorkspace();
```

**Key state:**
| State | Type | Description |
|-------|------|-------------|
| `folderPath` | `string \| null` | Currently open workspace |
| `tree` | `TreeEntry[]` | Recursive directory tree |
| `openTabs` | `Tab[]` | Open editor tabs |
| `activeTabPath` | `string \| null` | Currently focused tab |
| `gitSplitChanges` | `GitFileChange[]` | Staged + unstaged changes |
| `gitBranchInfo` | `GitBranchInfo \| null` | Current branch, ahead/behind |
| `npmProjects` | `NpmProject[]` | All package.json projects in workspace |
| `supabaseConfig` | `SupabaseConfig \| null` | Auto-detected Supabase project |

**Key actions:**
| Method | Description |
|--------|-------------|
| `importFolder()` | Open folder picker and load workspace |
| `openFile(name, path)` | Read file and add to editor tabs |
| `saveFile(path)` | Write tab content to disk |
| `refreshGitStatus()` | Re-fetch git changes and branch info |
| `stageFile(path)` / `unstageFile(path)` | Git stage/unstage |
| `gitCommit(msg)` | Commit staged changes |
| `openDiff(path)` | Open a diff tab for a changed file |

## Provider nesting order (in `main.tsx` → `App.tsx`)

```
<BackendProvider>              ← main.tsx
  <WorkspaceProvider>          ← App.tsx
    <AgentExecutionProvider>   ← App.tsx
      <AppLayout />
    </AgentExecutionProvider>
  </WorkspaceProvider>
</BackendProvider>
```

`WorkspaceProvider` depends on `useBackend()`, so `BackendProvider` must wrap it.
`AgentExecutionProvider` depends on `useBackend()` (for config persistence), so it sits inside `BackendProvider`.

### `AgentExecutionContext.tsx`

Bridge between the agent pipeline execution (in `ChatPanel`) and the agent observability UI (in `AgentsPanel`). Combines `useAgentConfigs` and `useAgentTrace` into a single API.

```tsx
// Used in ChatPanel to get the active agent and trace API:
const { activeAgent, startTrace, addStep, completeStep, finishTrace } = useAgentExecution();

// Used in AgentsPanel to read traces and configs:
const { agents, traces, activeTrace, createAgent, updateAgent } = useAgentExecution();
```

**Exports:**
| Export | Description |
|--------|-------------|
| `AgentExecutionProvider` | Context provider — wraps `useAgentConfigs()` + `useAgentTrace()` |
| `useAgentExecution()` | Hook — returns the combined `AgentExecutionAPI` |

**`AgentExecutionAPI` shape:**

| Category | Methods / State |
|----------|-----------------|
| Config | `agents`, `activeAgent`, `activeAgentId`, `setActiveAgentId`, `loading`, `createAgent`, `updateAgent`, `deleteAgent`, `renameAgent`, `duplicateAgent` |
| Trace | `traces`, `activeTrace`, `activeTraceId`, `setActiveTraceId`, `startTrace`, `addStep`, `updateStep`, `completeStep`, `failStep`, `finishTrace` |
