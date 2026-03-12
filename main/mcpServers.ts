/**
 * MCP Server Manager — main process module
 *
 * Handles downloading (npm install), launching (stdio), and communicating
 * with MCP (Model Context Protocol) servers.
 *
 * Each MCP server is an npm package that speaks JSON-RPC 2.0 over stdio.
 */
import * as path from 'path';
import * as fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { getUserDataDir } from '@flovia/core/dataDir';

// ── Types ────────────────────────────────────────────────────────────────────

export interface McpServerConfig {
  id: string;
  name: string;
  npmPackage: string;
  version?: string;
  status: McpServerStatus;
  args?: string[];
  env?: Record<string, string>;
  addedAt: string;
  tools?: McpTool[];
  resources?: McpResource[];
  lastError?: string;
}

export type McpServerStatus = 'not-installed' | 'installing' | 'installed' | 'connecting' | 'connected' | 'error' | 'stopped';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

// ── MCP servers directory ────────────────────────────────────────────────────

function getMcpDir(): string {
  const dir = path.join(getUserDataDir(), 'mcp-servers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getServerDir(serverId: string): string {
  return path.join(getMcpDir(), serverId);
}

// ── Running server processes ─────────────────────────────────────────────────

interface RunningServer {
  process: ChildProcess;
  config: McpServerConfig;
  buffer: string;
  pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>;
  nextId: number;
}

const runningServers = new Map<string, RunningServer>();

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

function sendJsonRpc(server: RunningServer, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = server.nextId++;
    server.pendingRequests.set(id, { resolve, reject });

    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
    const frame = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;

    try {
      server.process.stdin?.write(frame);
    } catch (err) {
      server.pendingRequests.delete(id);
      reject(new Error(`Failed to send message: ${err}`));
    }

    // Timeout after 30 seconds
    setTimeout(() => {
      if (server.pendingRequests.has(id)) {
        server.pendingRequests.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 30000);
  });
}

function handleServerData(server: RunningServer, data: string): void {
  server.buffer += data;

  // Parse JSON-RPC messages from the buffer (Content-Length framing)
  while (true) {
    const headerEnd = server.buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = server.buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      // Try plain JSON (some servers just send raw JSON lines)
      const newlineIdx = server.buffer.indexOf('\n');
      if (newlineIdx !== -1) {
        const line = server.buffer.substring(0, newlineIdx).trim();
        server.buffer = server.buffer.substring(newlineIdx + 1);
        if (line) {
          try {
            const msg = JSON.parse(line);
            processMessage(server, msg);
          } catch {
            // ignore malformed line
          }
        }
        continue;
      }
      break;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (server.buffer.length < bodyStart + contentLength) break;

    const body = server.buffer.substring(bodyStart, bodyStart + contentLength);
    server.buffer = server.buffer.substring(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body);
      processMessage(server, msg);
    } catch {
      // ignore malformed message
    }
  }
}

function processMessage(server: RunningServer, msg: any): void {
  if (msg.id !== undefined && server.pendingRequests.has(msg.id)) {
    const pending = server.pendingRequests.get(msg.id)!;
    server.pendingRequests.delete(msg.id);
    if (msg.error) {
      pending.reject(new Error(msg.error.message || 'RPC error'));
    } else {
      pending.resolve(msg.result);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Install an MCP server npm package into the mcp-servers directory.
 */
export async function installMcpServer(config: McpServerConfig): Promise<McpServerConfig> {
  const serverDir = getServerDir(config.id);

  // Create directory and package.json
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }

  const pkgJsonPath = path.join(serverDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ name: `mcp-${config.id}`, version: '1.0.0', private: true }, null, 2));
  }

  config.status = 'installing';

  return new Promise((resolve, reject) => {
    const packageSpec = config.version ? `${config.npmPackage}@${config.version}` : config.npmPackage;
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, ['install', packageSpec], {
      cwd: serverDir,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        config.status = 'installed';
        config.lastError = undefined;
        resolve(config);
      } else {
        config.status = 'error';
        config.lastError = `npm install failed (exit ${code}): ${stderr.slice(0, 500)}`;
        reject(new Error(config.lastError));
      }
    });

    child.on('error', (err) => {
      config.status = 'error';
      config.lastError = `npm install error: ${err.message}`;
      reject(new Error(config.lastError));
    });
  });
}

/**
 * Uninstall / remove an MCP server.
 */
export function uninstallMcpServer(serverId: string): void {
  // Stop the server first if running
  stopMcpServer(serverId);

  const serverDir = getServerDir(serverId);
  if (fs.existsSync(serverDir)) {
    fs.rmSync(serverDir, { recursive: true, force: true });
  }
}

/**
 * Start an MCP server process and perform the initialize handshake.
 */
export async function connectMcpServer(config: McpServerConfig): Promise<McpServerConfig> {
  // Stop existing if running
  stopMcpServer(config.id);

  const serverDir = getServerDir(config.id);

  // Find the server's bin entry point
  const nodeModulesDir = path.join(serverDir, 'node_modules');
  let binPath: string | null = null;

  // Try to find the package's bin
  const pkgPath = path.join(nodeModulesDir, config.npmPackage, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof pkg.bin === 'string') {
        binPath = path.join(nodeModulesDir, config.npmPackage, pkg.bin);
      } else if (typeof pkg.bin === 'object') {
        // Pick the first bin entry
        const firstBin = Object.values(pkg.bin)[0] as string;
        if (firstBin) binPath = path.join(nodeModulesDir, config.npmPackage, firstBin);
      }
      // Fallback to main
      if (!binPath && pkg.main) {
        binPath = path.join(nodeModulesDir, config.npmPackage, pkg.main);
      }
    } catch {}
  }

  // Fallback: look in .bin
  if (!binPath) {
    const dotBin = path.join(nodeModulesDir, '.bin');
    if (fs.existsSync(dotBin)) {
      const bins = fs.readdirSync(dotBin);
      const pkgName = config.npmPackage.split('/').pop() || config.npmPackage;
      const match = bins.find(b => b === pkgName || b.startsWith(pkgName));
      if (match) binPath = path.join(dotBin, match);
    }
  }

  if (!binPath || !fs.existsSync(binPath)) {
    config.status = 'error';
    config.lastError = `Cannot find executable for ${config.npmPackage}`;
    throw new Error(config.lastError);
  }

  config.status = 'connecting';

  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, ...(config.env || {}) };
    const args = config.args || [];

    const child = spawn('node', [binPath!, ...args], {
      cwd: serverDir,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const server: RunningServer = {
      process: child,
      config,
      buffer: '',
      pendingRequests: new Map(),
      nextId: 1,
    };

    child.stdout?.on('data', (data: Buffer) => {
      handleServerData(server, data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[MCP:${config.id}] stderr:`, data.toString());
    });

    child.on('error', (err) => {
      config.status = 'error';
      config.lastError = `Process error: ${err.message}`;
      runningServers.delete(config.id);
    });

    child.on('close', (code) => {
      if (config.status === 'connected' || config.status === 'connecting') {
        config.status = 'stopped';
      }
      runningServers.delete(config.id);
    });

    runningServers.set(config.id, server);

    // Perform MCP initialize handshake
    setTimeout(async () => {
      try {
        const initResult = await sendJsonRpc(server, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'flovia', version: '1.0.0' },
        });

        // Send initialized notification (no response expected)
        const notif = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
        const frame = `Content-Length: ${Buffer.byteLength(notif)}\r\n\r\n${notif}`;
        child.stdin?.write(frame);

        // List tools
        try {
          const toolsResult = await sendJsonRpc(server, 'tools/list', {});
          config.tools = toolsResult?.tools || [];
        } catch {
          config.tools = [];
        }

        // List resources
        try {
          const resourcesResult = await sendJsonRpc(server, 'resources/list', {});
          config.resources = resourcesResult?.resources || [];
        } catch {
          config.resources = [];
        }

        config.status = 'connected';
        config.lastError = undefined;
        resolve(config);
      } catch (err: any) {
        config.status = 'error';
        config.lastError = `Initialize failed: ${err.message}`;
        stopMcpServer(config.id);
        reject(new Error(config.lastError));
      }
    }, 500); // Small delay for process startup
  });
}

/**
 * Stop a running MCP server.
 */
export function stopMcpServer(serverId: string): void {
  const server = runningServers.get(serverId);
  if (server) {
    try {
      server.process.kill();
    } catch {}
    server.pendingRequests.forEach((p) => p.reject(new Error('Server stopped')));
    server.pendingRequests.clear();
    runningServers.delete(serverId);
  }
}

/**
 * Call a tool on a connected MCP server.
 */
export async function callMcpTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
  const server = runningServers.get(serverId);
  if (!server) throw new Error(`Server ${serverId} is not running`);

  const result = await sendJsonRpc(server, 'tools/call', { name: toolName, arguments: args });
  return result;
}

/**
 * Read a resource from a connected MCP server.
 */
export async function readMcpResource(serverId: string, uri: string): Promise<any> {
  const server = runningServers.get(serverId);
  if (!server) throw new Error(`Server ${serverId} is not running`);

  const result = await sendJsonRpc(server, 'resources/read', { uri });
  return result;
}

/**
 * Check if a server is installed (has node_modules).
 */
export function isServerInstalled(serverId: string): boolean {
  const serverDir = getServerDir(serverId);
  return fs.existsSync(path.join(serverDir, 'node_modules'));
}

/**
 * Check if a server is currently connected.
 */
export function isServerConnected(serverId: string): boolean {
  return runningServers.has(serverId);
}

/**
 * Kill all running MCP servers (for app shutdown).
 */
export function killAllMcpServers(): void {
  for (const [id] of runningServers) {
    stopMcpServer(id);
  }
}
