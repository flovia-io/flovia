/**
 * Enterprise Cloud Server
 * 
 * This is the server-side entrypoint for the cloud/enterprise version.
 * It exposes the same operations as the Electron main process,
 * but over HTTP REST endpoints + WebSocket instead of IPC.
 * 
 * Run with: npx tsx server/index.ts
 * 
 * Architecture:
 * ┌─────────────┐     HTTP/WS      ┌──────────────────┐
 * │  React SPA  │ ◄──────────────► │  Express Server   │
 * │  (renderer) │                   │  ┌──────────────┐ │
 * └─────────────┘                   │  │  Connector   │ │
 *                                   │  │  Registry    │ │
 *                                   │  └──────────────┘ │
 *                                   │  ┌──────────────┐ │
 *                                   │  │  REST + WS   │ │
 *                                   │  │   Routes     │ │
 *                                   │  └──────────────┘ │
 *                                   └──────────────────┘
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { getConnectorRegistry } from '@flovia/core/connector';
import { registerBuiltInConnectors } from '@flovia/connectors';
import { restoreConnectorStates } from '@flovia/core/connector-bootstrap';
import { getStorage } from '@flovia/core/storage';
import apiRoutes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Request logging ───

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Serve static SPA in production / web mode ───

const rendererDist = path.resolve(__dirname, '..', 'renderer', 'dist');
app.use(express.static(rendererDist));

// ─── Bootstrap ───

registerBuiltInConnectors();
const registry = getConnectorRegistry();
const storage = getStorage();

// Restore saved connector configs and states from disk (shared logic)
restoreConnectorStates(registry, storage.loadConnectorConfigs() as Record<string, import('../core/storage').PersistedConnectorData>);

// ─── Middleware placeholder for enterprise auth ───

// In enterprise mode, you'd add JWT/OAuth middleware here:
// app.use('/api', authMiddleware);

// ─── Mount REST API routes ───

app.use('/api', apiRoutes);

// ─── Global error handler ───

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Server Error] ${err.message}`, err.stack);
  res.status(500).json({ success: false, error: err.message ?? 'Internal server error' });
});

// ─── Connector REST API (kept for backward compat) ───

app.get('/api/connectors', (_req, res) => {
  const connectors = registry.listConnectors();
  res.json({ connectors });
});

app.get('/api/connectors/:id', (req, res) => {
  const connector = registry.get(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: `Connector "${req.params.id}" not found` });
  }
  res.json({
    metadata: connector.metadata,
    configFields: connector.configFields,
    actions: connector.actions,
    state: registry.getState(req.params.id),
  });
});

app.get('/api/connectors/:id/state', (req, res) => {
  res.json(registry.getState(req.params.id));
});

app.post('/api/connectors/:id/test', async (req, res) => {
  try {
    const result = await registry.testConnection(req.params.id, req.body.config);
    const state = registry.getState(req.params.id);
    storage.saveConnectorState(req.params.id, state);
    if (result.success) {
      storage.saveConnectorConfig(req.params.id, req.body.config, state);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.post('/api/connectors/:id/config', (req, res) => {
  registry.setConfig(req.params.id, req.body.config);
  storage.saveConnectorConfig(req.params.id, req.body.config);
  res.json({ success: true });
});

app.get('/api/connectors/:id/config', (req, res) => {
  const config = registry.getConfig(req.params.id) ?? storage.loadSingleConnectorConfig(req.params.id);
  res.json(config ?? null);
});

app.post('/api/connectors/:id/actions/:actionId', async (req, res) => {
  try {
    const result = await registry.executeAction(
      req.params.id,
      req.params.actionId,
      req.body.params,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── Health Check ───

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'cloud',
    connectors: registry.listConnectors().length,
    uptime: process.uptime(),
  });
});

// ─── HTTP + WebSocket Server ───

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');

  ws.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { event, args } = msg;

      switch (event) {
        case 'terminal-input':
          // In a full implementation, pipe to a pty process
          console.log('[WS] terminal-input', args?.[0]);
          break;

        case 'terminal-resize':
          console.log('[WS] terminal-resize', args);
          break;

        case 'ai-chat-stream':
          // In a full implementation, stream AI chunks back via WS
          (async () => {
            try {
              const { chatCompleteStream } = await import('../main/ai');
              const { baseUrl, apiKey, model, messages } = args?.[0] ?? {};
              const onChunk = (chunk: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ event: 'ai-chat-chunk', args: [chunk] }));
                }
              };
              await chatCompleteStream(baseUrl, apiKey, model, messages, onChunk);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'ai-chat-chunk-done', args: [] }));
              }
            } catch (err) {
              console.error('[WS] ai-chat-stream error:', err);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'ai-chat-chunk-done', args: [] }));
              }
            }
          })();
          break;

        default:
          console.log('[WS] Unknown event:', event);
      }
    } catch {
      /* ignore non-JSON */
    }
  });

  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ─── Start Server ───

server.listen(PORT, () => {
  console.log(`\n🚀 flovia Server running on http://localhost:${PORT}`);
  console.log(`   ${registry.listConnectors().length} connectors registered`);
  console.log(`   REST API:  http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   UI:        http://localhost:${PORT}/\n`);
});

// ─── SPA fallback — serve index.html for all non-API routes ───

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(rendererDist, 'index.html'));
});

export default app;
