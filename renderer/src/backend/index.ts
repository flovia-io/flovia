/**
 * Backend Adapter — auto-detect and export
 *
 * Detects whether we're running inside Electron (preload bridge exists)
 * or as a regular web app, and instantiates the correct adapter once.
 */

export type { BackendAPI, BackendMode, Unsubscribe } from './types';

import type { BackendAPI } from './types';
import { createElectronAdapter } from './electron-adapter';
import { createHttpAdapter } from './http-adapter';

/** True when the Electron preload bridge is available. */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

/** Lazily-created singleton adapter. */
let _backend: BackendAPI | null = null;

/**
 * Returns the singleton `BackendAPI` instance.
 * Safe to call from module scope or inside components.
 */
export function getBackend(): BackendAPI {
  if (!_backend) {
    _backend = isElectron() ? createElectronAdapter() : createHttpAdapter();
    console.log(`[Backend] initialised in "${_backend.mode}" mode`);
  }
  return _backend;
}
