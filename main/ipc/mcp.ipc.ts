/**
 * MCP Server IPC handlers
 */
import { ipcMain } from 'electron';
import {
  installMcpServer,
  uninstallMcpServer,
  connectMcpServer,
  stopMcpServer,
  callMcpTool,
  readMcpResource,
  isServerInstalled,
  isServerConnected,
  type McpServerConfig,
} from '../mcpServers';
import { loadMcpServers, saveMcpServers } from '../storage';

export function registerMcpIpc(): void {
  // ── Load saved servers ──
  ipcMain.handle('mcp-load-servers', async () => {
    const servers = loadMcpServers();
    // Update statuses based on actual state
    for (const s of servers) {
      if (isServerConnected(s.id)) {
        s.status = 'connected';
      } else if (isServerInstalled(s.id)) {
        s.status = 'installed';
      } else {
        s.status = 'not-installed';
      }
    }
    return { servers };
  });

  // ── Save servers config ──
  ipcMain.handle('mcp-save-servers', async (_event, servers: McpServerConfig[]) => {
    saveMcpServers(servers);
    return { success: true };
  });

  // ── Install a server ──
  ipcMain.handle('mcp-install-server', async (_event, config: McpServerConfig) => {
    try {
      const result = await installMcpServer(config);
      // Persist
      const servers = loadMcpServers();
      const idx = servers.findIndex(s => s.id === config.id);
      if (idx >= 0) {
        servers[idx] = result;
      } else {
        servers.push(result);
      }
      saveMcpServers(servers);
      return { success: true, server: result };
    } catch (err: any) {
      return { success: false, error: err.message, server: config };
    }
  });

  // ── Uninstall a server ──
  ipcMain.handle('mcp-uninstall-server', async (_event, serverId: string) => {
    try {
      uninstallMcpServer(serverId);
      const servers = loadMcpServers().filter(s => s.id !== serverId);
      saveMcpServers(servers);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Connect to a server ──
  ipcMain.handle('mcp-connect-server', async (_event, serverId: string) => {
    try {
      const servers = loadMcpServers();
      const config = servers.find(s => s.id === serverId);
      if (!config) throw new Error(`Server ${serverId} not found`);

      const result = await connectMcpServer(config);
      // Update persisted state
      const updatedServers = loadMcpServers();
      const idx = updatedServers.findIndex(s => s.id === serverId);
      if (idx >= 0) updatedServers[idx] = result;
      saveMcpServers(updatedServers);

      return { success: true, server: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Disconnect a server ──
  ipcMain.handle('mcp-disconnect-server', async (_event, serverId: string) => {
    try {
      stopMcpServer(serverId);
      const servers = loadMcpServers();
      const idx = servers.findIndex(s => s.id === serverId);
      if (idx >= 0) {
        servers[idx].status = 'stopped';
        saveMcpServers(servers);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Call a tool ──
  ipcMain.handle('mcp-call-tool', async (_event, serverId: string, toolName: string, args: Record<string, unknown>) => {
    try {
      const result = await callMcpTool(serverId, toolName, args);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Read a resource ──
  ipcMain.handle('mcp-read-resource', async (_event, serverId: string, uri: string) => {
    try {
      const result = await readMcpResource(serverId, uri);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
