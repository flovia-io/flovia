/**
 * Storage Port — Hexagonal architecture persistence interface.
 *
 * All persistence in the system goes through this port.
 * Electron adapter: reads/writes JSON files in userDataDir.
 * Cloud adapter:    reads/writes to a database (Postgres, SQLite, etc.).
 *
 * Domain modules never know *where* data is stored.
 */

// ─── Connector Persistence ──────────────────────────────────────────────────

export interface PersistedConnectorData {
  config: Record<string, unknown>;
  state: { status: string; error?: string; lastConnected?: string };
}

// ─── Storage Port ───────────────────────────────────────────────────────────

/**
 * The port that all persistence adapters implement.
 * Used by orchestrator, connector bootstrap, and domain services.
 */
export interface StoragePort {
  // ── Generic key/value ──
  /** Read a JSON blob by key. Returns `fallback` if missing. */
  readJSON<T>(key: string, fallback: T): T | Promise<T>;
  /** Write a JSON blob by key. */
  writeJSON(key: string, data: unknown): void | Promise<void>;

  // ── Connector configs (keyed by connectorId) ──
  loadConnectorConfigs(): Record<string, PersistedConnectorData> | Promise<Record<string, PersistedConnectorData>>;
  saveConnectorConfig(
    connectorId: string,
    config: Record<string, unknown>,
    state?: { status: string; error?: string; lastConnected?: string },
  ): void | Promise<void>;
  saveConnectorState(
    connectorId: string,
    state: { status: string; error?: string; lastConnected?: string },
  ): void | Promise<void>;
  loadSingleConnectorConfig(connectorId: string): Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
}

// ─── File-based adapter (used by Electron main & standalone server) ─────────

import * as fs from 'fs';
import * as path from 'path';
import { getUserDataDir } from './dataDir';

function dataFile(name: string): string {
  return path.join(getUserDataDir(), name);
}

function readJSONFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSONFile(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export class FileStorageAdapter implements StoragePort {
  readJSON<T>(key: string, fallback: T): T {
    return readJSONFile(dataFile(`${key}.json`), fallback);
  }

  writeJSON(key: string, data: unknown): void {
    writeJSONFile(dataFile(`${key}.json`), data);
  }

  loadConnectorConfigs(): Record<string, PersistedConnectorData> {
    const raw = readJSONFile<Record<string, unknown>>(dataFile('connector-configs.json'), {});
    const result: Record<string, PersistedConnectorData> = {};

    for (const [id, value] of Object.entries(raw)) {
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (obj.config && typeof obj.config === 'object' && obj.state && typeof obj.state === 'object') {
          result[id] = obj as unknown as PersistedConnectorData;
        } else {
          // Old format: the value IS the config directly — migrate it
          result[id] = {
            config: obj as Record<string, unknown>,
            state: { status: 'connected', lastConnected: new Date().toISOString() },
          };
        }
      }
    }
    return result;
  }

  saveConnectorConfig(
    connectorId: string,
    config: Record<string, unknown>,
    state?: { status: string; error?: string; lastConnected?: string },
  ): void {
    const all = this.loadConnectorConfigs();
    if (Object.keys(config).length === 0) {
      delete all[connectorId];
    } else {
      all[connectorId] = {
        config,
        state: state ?? all[connectorId]?.state ?? { status: 'disconnected' },
      };
    }
    writeJSONFile(dataFile('connector-configs.json'), all);
  }

  saveConnectorState(
    connectorId: string,
    state: { status: string; error?: string; lastConnected?: string },
  ): void {
    const all = this.loadConnectorConfigs();
    if (all[connectorId]) {
      all[connectorId].state = state;
      writeJSONFile(dataFile('connector-configs.json'), all);
    }
  }

  loadSingleConnectorConfig(connectorId: string): Record<string, unknown> | null {
    const all = this.loadConnectorConfigs();
    return all[connectorId]?.config ?? null;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _storage: StoragePort | null = null;

/** Get the global storage adapter. Defaults to FileStorageAdapter. */
export function getStorage(): StoragePort {
  if (!_storage) {
    _storage = new FileStorageAdapter();
  }
  return _storage;
}

/** Override the global storage adapter (e.g. for testing or cloud mode). */
export function setStorage(adapter: StoragePort): void {
  _storage = adapter;
}
