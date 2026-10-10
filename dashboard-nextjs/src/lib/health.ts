import dbConnect from "@/lib/mongodb";
import BotStatus, { BOT_HEARTBEAT_STALE_MS, type BotStatusDoc } from "@/models/BotStatus";

/**
 * Stan usługi dla publicznego /api/health (monitor zewnętrzny + strona status.deezy.cc).
 *
 * Odpowiedź celowo mówi minimum: dla każdego elementu tylko „ok” albo „down” — bez wersji,
 * adresów, nazw kontenerów ani treści błędów. Wynik jest trzymany krótko w pamięci, żeby
 * zalewanie tego publicznego adresu zapytaniami nie przekładało się na zapytania do bazy.
 */

export type ComponentState = "ok" | "down";

export interface HealthReport {
  status: "ok" | "degraded";
  components: {
    dashboard: ComponentState;
    database: ComponentState;
    bot: ComponentState;
  };
}

export const HEALTH_CACHE_MS = 15_000;
const DB_TIMEOUT_MS = 3_000;

export function evaluateHealth(input: {
  databaseOk: boolean;
  botHeartbeatAt: Date | null;
  now?: number;
}): HealthReport {
  const now = input.now ?? Date.now();
  const botOk =
    input.databaseOk &&
    input.botHeartbeatAt !== null &&
    now - input.botHeartbeatAt.getTime() <= BOT_HEARTBEAT_STALE_MS;

  const components = {
    dashboard: "ok" as const,
    database: input.databaseOk ? ("ok" as const) : ("down" as const),
    bot: botOk ? ("ok" as const) : ("down" as const),
  };
  return {
    status: components.database === "ok" && components.bot === "ok" ? "ok" : "degraded",
    components,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function readBotHeartbeat(): Promise<{ databaseOk: boolean; botHeartbeatAt: Date | null }> {
  try {
    const doc = await withTimeout(
      (async () => {
        await dbConnect();
        return BotStatus.findOne({ key: "main" }).lean<BotStatusDoc | null>();
      })(),
      DB_TIMEOUT_MS
    );
    return { databaseOk: true, botHeartbeatAt: doc?.updatedAt ? new Date(doc.updatedAt) : null };
  } catch {
    return { databaseOk: false, botHeartbeatAt: null };
  }
}

let cache: { report: HealthReport; at: number } | null = null;
let inflight: Promise<HealthReport> | null = null;

export async function getHealth(now = Date.now()): Promise<HealthReport> {
  if (cache && now - cache.at < HEALTH_CACHE_MS) return cache.report;
  // Kilka równoczesnych zapytań = jedno sprawdzenie bazy.
  inflight ??= readBotHeartbeat()
    .then((input) => {
      const report = evaluateHealth({ ...input, now: Date.now() });
      cache = { report, at: Date.now() };
      return report;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Tylko do testów. */
export function resetHealthCache(): void {
  cache = null;
  inflight = null;
}
