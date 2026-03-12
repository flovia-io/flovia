/**
 * IPC handler barrel — assembles all domain-specific IPC registrations.
 */
export { registerFsIpc } from './fs.ipc';
export { registerAiIpc } from './ai.ipc';
export { registerHistoryIpc } from './history.ipc';
export { registerPromptsIpc } from './prompts.ipc';
export { registerIntegrationsIpc } from './integrations.ipc';
export { registerWindowIpc } from './window.ipc';
export { registerMcpIpc } from './mcp.ipc';
export { registerCliProviderIpc } from './cliProvider.ipc';
export { registerAgentIpc } from './agent.ipc';
export { registerSessionIpc } from './session.ipc';
export { registerOrchestratorIpc } from './orchestrator.ipc';

/** @deprecated Use registerCliProviderIpc — this re-export exists for backward compat */
export { registerGhCliIpc } from './ghCli.ipc';
