import { z } from 'zod';
import logger from '../utils/logger';

/**
 * Konfiguracja funkcji Minecraft (serwer GameZone). Działa WYŁĄCZNIE na jednym serwerze Discord
 * (`MC_GUILD_ID`). Brak albo błąd którejkolwiek zmiennej = funkcja wyłączona (jedno ostrzeżenie
 * w logu), reszta bota działa normalnie - dlatego to osobny schemat, a nie część EnvSchema.
 */

const snowflake = z.string().regex(/^\d{17,20}$/, 'musi być ID z Discorda');
const port = z.coerce.number().int().min(1).max(65_535);

export const MinecraftEnvSchema = z.object({
  MC_GUILD_ID: snowflake,
  MC_STARTER_ROLE_ID: snowflake,
  MC_HOST: z.string().min(1).max(253),
  MC_PORT: port.default(25_565),
  MC_RCON_PORT: port.default(25_575),
  MC_CONTROL_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), 'musi zaczynać się od https://'),
  MC_CONTROL_TOKEN: z.string().min(16, 'token jest za krótki'),
  MC_RCON_PASSWORD: z.string().min(1),
  /**
   * Po tym bot rozpoznaje SWÓJ serwer w odpowiedzi pingu. IP po wyłączeniu maszyny może trafić
   * do kogoś innego (też z serwerem MC) - bez tej kontroli dałoby to fałszywe 🟢.
   */
  MC_EXPECTED_MOTD: z.string().min(1).max(200).default('GameZone Pack v5'),
  MC_EXPECTED_VERSION: z.string().min(1).max(50).default('1.20.1'),
});

export interface MinecraftConfig {
  guildId: string;
  starterRoleId: string;
  displayHost: string;
  gamePort: number;
  rconPort: number;
  controlUrl: string;
  controlToken: string;
  rconPassword: string;
  expectedMotd: string;
  expectedVersion: string;
}

/** Bez efektów ubocznych - używane w testach i przez getMinecraftConfig(). */
export function parseMinecraftConfig(
  source: Record<string, string | undefined>
): { ok: true; config: MinecraftConfig } | { ok: false; problems: string[] } {
  // Pusta wartość w .env (np. `MC_EXPECTED_MOTD=`) = brak zmiennej, a nie błąd.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''));
  const parsed = MinecraftEnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    // Tylko nazwy zmiennych i opis problemu - nigdy wartości (token, hasło).
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { ok: false, problems };
  }
  const env = parsed.data;
  return {
    ok: true,
    config: {
      guildId: env.MC_GUILD_ID,
      starterRoleId: env.MC_STARTER_ROLE_ID,
      displayHost: env.MC_HOST,
      gamePort: env.MC_PORT,
      rconPort: env.MC_RCON_PORT,
      controlUrl: env.MC_CONTROL_URL.replace(/\/+$/, ''),
      controlToken: env.MC_CONTROL_TOKEN,
      rconPassword: env.MC_RCON_PASSWORD,
      expectedMotd: env.MC_EXPECTED_MOTD,
      expectedVersion: env.MC_EXPECTED_VERSION,
    },
  };
}

let cached: MinecraftConfig | null | undefined;

/** Konfiguracja MC albo `null`, gdy funkcja jest wyłączona. Ostrzeżenie logowane raz. */
export function getMinecraftConfig(): MinecraftConfig | null {
  if (cached !== undefined) return cached;
  const result = parseMinecraftConfig(process.env);
  if (result.ok) {
    cached = result.config;
    logger.info(`[MC] Funkcja Minecraft włączona (serwer ${result.config.guildId}).`);
  } else {
    cached = null;
    const anySet = Object.keys(MinecraftEnvSchema.shape).some((key) => process.env[key]);
    // Instancja bez żadnej zmiennej MC (np. developerska) - cicha informacja zamiast ostrzeżenia.
    if (anySet) logger.warn(`[MC] Funkcja Minecraft wyłączona - błędna konfiguracja: ${result.problems.join('; ')}`);
    else logger.info('[MC] Funkcja Minecraft wyłączona (brak zmiennych MC_*).');
  }
  return cached;
}

/** Tylko dla testów. */
export function resetMinecraftConfigCache(): void {
  cached = undefined;
}
