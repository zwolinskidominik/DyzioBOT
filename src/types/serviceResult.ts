/**
 * Unified result type for all service-layer functions.
 *
 * Success  → `{ ok: true,  data: T }`
 * Failure  → `{ ok: false, code: string, message: string }`
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

/* ── Convenience factory helpers ─────────────────────────────────── */

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(code: string, message: string): ServiceResult<T> {
  return { ok: false, code, message };
}
