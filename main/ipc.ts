/**
 * IPC Registration — thin orchestrator that delegates to domain-specific handlers.
 */
import type { BrowserWindow as BW } from 'electron';
import { registerDebugIpc } from './debugWindow';
import {
  registerFsIpc,
  registerAiIpc,
  registerHistoryIpc,
  registerPromptsIpc,
  registerIntegrationsIpc,
  registerWindowIpc,
  registerMcpIpc,
  registerCliProviderIpc,
  registerAgentIpc,
  registerSessionIpc,
  registerOrchestratorIpc,
} from './ipc/index';

export function registerIpcHandlers(getWindow: () => BW | null): void {
  registerWindowIpc();
  registerFsIpc();
  registerAiIpc(getWindow);
  registerPromptsIpc();
  registerHistoryIpc();
  registerIntegrationsIpc();
  registerDebugIpc();
  registerMcpIpc();
  registerCliProviderIpc(getWindow);
  registerAgentIpc();
  registerSessionIpc();
  registerOrchestratorIpc();
}
