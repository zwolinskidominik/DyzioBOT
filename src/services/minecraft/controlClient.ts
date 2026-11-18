import { z } from 'zod';
import { fetch } from 'undici';
import logger from '../../utils/logger';
import type { MinecraftConfig } from '../../config/minecraft';

/**
 * Klient usługi „gamezone-control” (Cloud Run). To ona włącza maszynę z Minecraftem i podaje jej
 * stan oraz aktualne IP (zmienia się przy każdym starcie). Bot nie zna żadnych kluczy Google.
 *
 * - token w nagłówku `Authorization: Bearer`, nigdy w logach;
 * - limit czasu 10 s (zimny start Cloud Run trwa 1-3 s);
 * - najwyżej jedno zapytanie na 10 s (usługa ma jedną instancję) - częstsze dostają ostatni wynik.
 */

export const MACHINE_STATUSES = [
  'RUNNING',
  'TERMINATED',
  'STOPPED',
  'STOPPING',
  'PROVISIONING',
  'STAGING',
  'SUSPENDING',
  'SUSPENDED',
  'REPAIRING',
] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

const ipv4 = z.string().regex(/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/);

export const ControlResponseSchema = z.object({
  status: z.enum(MACHINE_STATUSES),
  ip: ipv4.nullable(),
  lastStart: z.string().datetime({ offset: true }).nullable(),
  started: z.boolean(),
});

export interface MachineInfo {
  status: MachineStatus;
  ip: string | null;
  lastStart: Date | null;
  started: boolean;
}

export type ControlErrorKind = 'config' | 'unavailable';

export type ControlResult = { ok: true; data: MachineInfo } | { ok: false; kind: ControlErrorKind };

export const CONTROL_TIMEOUT_MS = 10_000;
export const CONTROL_MIN_INTERVAL_MS = 10_000;

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface ControlClientDeps {
  fetchImpl?: FetchLike | undefined;
  now?: (() => number) | undefined;
}

export class ControlClient {
  private lastCallAt = 0;
  private lastResult: ControlResult | null = null;
  private inFlight: Promise<ControlResult> | null = null;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;

  public constructor(
    private readonly config: Pick<MinecraftConfig, 'controlUrl' | 'controlToken'>,
    deps: ControlClientDeps = {}
  ) {
    this.fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
    this.now = deps.now ?? Date.now;
  }

  /** Stan maszyny. W ciągu 10 s od poprzedniego zapytania zwraca zapamiętany wynik. */
  public status(): Promise<ControlResult> {
    return this.call('GET', '/status');
  }

  /**
   * Start maszyny. Usługa sama nic nie robi, gdy maszyna już działa (`started: false`).
   * Start NIE korzysta z pamięci wyniku - zawsze idzie do usługi (o ile nie trwa inne zapytanie).
   */
  public start(): Promise<ControlResult> {
    return this.call('POST', '/start', true);
  }

  private async call(method: 'GET' | 'POST', path: string, force = false): Promise<ControlResult> {
    if (this.inFlight) return this.inFlight;
    if (!force && this.lastResult && this.now() - this.lastCallAt < CONTROL_MIN_INTERVAL_MS) {
      return this.lastResult;
    }
    this.lastCallAt = this.now();
    this.inFlight = this.request(method, path).finally(() => {
      this.inFlight = null;
    });
    const result = await this.inFlight;
    this.lastResult = result;
    return result;
  }

  private async request(method: 'GET' | 'POST', path: string): Promise<ControlResult> {
    try {
      const response = await this.fetchImpl(`${this.config.controlUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.config.controlToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        logger.error(`[MC] gamezone-control odpowiada ${response.status} - sprawdź MC_CONTROL_URL i MC_CONTROL_TOKEN.`);
        return { ok: false, kind: 'config' };
      }
      if (response.status !== 200) {
        logger.warn(`[MC] gamezone-control odpowiada ${response.status} (${method} ${path}).`);
        return { ok: false, kind: 'unavailable' };
      }
      const parsed = ControlResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        logger.warn(`[MC] gamezone-control zwróciło nieoczekiwaną odpowiedź (${method} ${path}).`);
        return { ok: false, kind: 'unavailable' };
      }
      const body = parsed.data;
      return {
        ok: true,
        data: {
          status: body.status,
          ip: body.ip,
          lastStart: body.lastStart ? new Date(body.lastStart) : null,
          started: body.started,
        },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'error';
      logger.warn(`[MC] Brak odpowiedzi gamezone-control (${method} ${path}): ${reason}`);
      return { ok: false, kind: 'unavailable' };
    }
  }
}
