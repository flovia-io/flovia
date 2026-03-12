/**
 * Shared route helpers.
 */
import type { Response } from 'express';

export function ok(res: Response, data: unknown = { success: true }) {
  res.json(data);
}

export function fail(res: Response, err: unknown, status = 500) {
  res.status(status).json({ success: false, error: (err as Error).message ?? String(err) });
}
