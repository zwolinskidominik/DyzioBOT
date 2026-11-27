import { z } from 'zod';
import { fetch } from 'undici';
import type { MinecraftConfig } from '../../config/minecraft';
import { MinecraftStatsSnapshotModel } from '../../models/MinecraftStatsSnapshot';
import { MinecraftLinkModel } from '../../models/MinecraftLink';
import logger from '../../utils/logger';

/**
 * Statystyki graczy GameZone z usługi gamezone-control: GET /stats (Bearer MC_CONTROL_TOKEN).
 * Usługa czyta pliki world/stats/*.json (pełna historia świata), bot tylko je pobiera:
 * najwyżej raz na 5 min, a ostatni wynik trzyma w bazie - gdy usługa nie odpowiada, komendy
 * pokazują ostatnie znane dane.
 *
 * Kontrakt odpowiedzi (200):
 *   { "updatedAt": "2026-11-27T12:00:00Z" | null,
 *     "players": [ { "uuid": "…", "name": "Kuba", "playTime": 123456, "deaths": 7 } ] }
 * playTime = minecraft:custom/minecraft:play_time w tickach (20 / s), deaths = minecraft:custom/minecraft:deaths.
 */

export const STATS_CACHE_MS = 5 * 60_000;
export const STATS_TIMEOUT_MS = 10_000;

const PlayerSchema = z.object({
  uuid: z.string().min(1).max(64),
  name: z.string().regex(/^[A-Za-z0-9_]{1,16}$/),
  playTime: z.number().int().min(0),
  deaths: z.number().int().min(0),
});

export const StatsResponseSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  players: z.array(PlayerSchema).max(5000),
});

export interface PlayerStats {
  uuid: string;
  name: string;
  playTime: number;
  deaths: number;
}

export interface StatsSnapshot {
  updatedAt: Date | null;
  players: PlayerStats[];
  /** true = dane z bazy, bo usługa w tej chwili nie odpowiedziała. */
  stale: boolean;
}

export type StatsResult = { ok: true; data: StatsSnapshot } | { ok: false; reason: 'not_ready' | 'unavailable' };

export type StatsMetric = 'playtime' | 'deaths';

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface StatsDeps {
  fetchImpl?: FetchLike | undefined;
  now?: (() => number) | undefined;
}

export class MinecraftStatsService {
  private cache: { at: number; data: StatsSnapshot } | null = null;
  private inFlight: Promise<StatsResult> | null = null;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;

  public constructor(
    private readonly config: Pick<MinecraftConfig, 'guildId' | 'controlUrl' | 'controlToken'>,
    deps: StatsDeps = {}
  ) {
    this.fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
    this.now = deps.now ?? Date.now;
  }

  public get(): Promise<StatsResult> {
    if (this.cache && this.now() - this.cache.at < STATS_CACHE_MS) return Promise.resolve({ ok: true, data: this.cache.data });
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.load().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(): Promise<StatsResult> {
    const fresh = await this.fetchStats();
    if (fresh.ok) {
      this.cache = { at: this.now(), data: fresh.data };
      await MinecraftStatsSnapshotModel.updateOne(
        { guildId: this.config.guildId },
        { $set: { statsUpdatedAt: fresh.data.updatedAt, players: fresh.data.players } },
        { upsert: true }
      ).catch((err: unknown) => logger.warn(`[MC] Nie udało się zapisać statystyk w bazie: ${err}`));
      return fresh;
    }
    // Usługa nie odpowiada albo nie ma jeszcze /stats - ostatnie znane dane z bazy.
    const saved = await MinecraftStatsSnapshotModel.findOne({ guildId: this.config.guildId })
      .lean()
      .catch(() => null);
    if (saved && saved.players.length > 0) {
      const data: StatsSnapshot = {
        updatedAt: saved.statsUpdatedAt ?? null,
        players: saved.players.map((p) => ({ uuid: p.uuid, name: p.name, playTime: p.playTime, deaths: p.deaths })),
        stale: true,
      };
      return { ok: true, data };
    }
    return fresh;
  }

  private async fetchStats(): Promise<StatsResult> {
    try {
      const response = await this.fetchImpl(`${this.config.controlUrl}/stats`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.config.controlToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(STATS_TIMEOUT_MS),
      });
      if (response.status === 404) return { ok: false, reason: 'not_ready' };
      if (response.status !== 200) {
        logger.warn(`[MC] gamezone-control /stats odpowiada ${response.status}.`);
        return { ok: false, reason: 'unavailable' };
      }
      const parsed = StatsResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        logger.warn('[MC] gamezone-control /stats zwróciło nieoczekiwaną odpowiedź.');
        return { ok: false, reason: 'unavailable' };
      }
      return {
        ok: true,
        data: {
          updatedAt: parsed.data.updatedAt ? new Date(parsed.data.updatedAt) : null,
          players: parsed.data.players,
          stale: false,
        },
      };
    } catch (err) {
      logger.warn(`[MC] Brak odpowiedzi gamezone-control /stats: ${err instanceof Error ? err.name : 'error'}`);
      return { ok: false, reason: 'unavailable' };
    }
  }
}

/** Ranking: malejąco według metryki, przy remisie alfabetycznie po nicku. */
export function rankPlayers(players: PlayerStats[], metric: StatsMetric): PlayerStats[] {
  const value = (p: PlayerStats) => (metric === 'playtime' ? p.playTime : p.deaths);
  return [...players].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
}

export function findPlayer(players: PlayerStats[], nick: string): PlayerStats | null {
  const lower = nick.toLowerCase();
  return players.find((p) => p.name.toLowerCase() === lower) ?? null;
}

/** Ticki → „12 h 5 min” (albo „35 min”). */
export function formatPlayTime(ticks: number): string {
  const minutes = Math.floor(ticks / 20 / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

/** Nick z whitelisty powiązany z kontem Discord (null = osoba nie jest na whiteliście). */
export async function linkedNick(guildId: string, userId: string): Promise<string | null> {
  const link = await MinecraftLinkModel.findOne({ guildId, userId }).lean();
  return link?.nick ?? null;
}

/** Discord userId po nicku z whitelisty (do wzmianek w topce). */
export async function userIdsByNick(guildId: string): Promise<Map<string, string>> {
  const links = await MinecraftLinkModel.find({ guildId }).select({ userId: 1, nickLower: 1 }).lean();
  return new Map(links.map((l) => [l.nickLower, l.userId]));
}
