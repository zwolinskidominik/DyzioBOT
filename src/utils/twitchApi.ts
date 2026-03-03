/**
 * Shared Twitch API client (singleton).
 *
 * Uses @twurple/auth `AppTokenAuthProvider` which handles:
 *  - Automatic app access token generation & refresh
 *  - Built‑in rate‑limit handling (800 req/min for app tokens)
 *    → twurple queues requests when approaching the limit
 *    → respects Ratelimit‑Remaining / Ratelimit‑Reset headers
 *
 * Rate‑limit summary (Twitch Helix API):
 *  ┌──────────────────┬─────────────────────────────────┐
 *  │ Token type       │ Limit                           │
 *  ├──────────────────┼─────────────────────────────────┤
 *  │ App access token │ 800 requests / 60 s (shared)    │
 *  │ User token       │ 800 requests / 60 s (per user)  │
 *  └──────────────────┴─────────────────────────────────┘
 *  Headers: Ratelimit-Limit, Ratelimit-Remaining, Ratelimit-Reset
 *  @twurple handles all of this automatically.
 */

import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { env } from '../config';
import logger from './logger';

let _client: ApiClient | null = null;

/**
 * Get or create the shared Twitch API client.
 * Returns `null` if TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are missing.
 */
export function getTwitchClient(): ApiClient | null {
  if (_client) return _client;

  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    logger.warn('Brak TWITCH_CLIENT_ID lub TWITCH_CLIENT_SECRET – Twitch API wyłączone.');
    return null;
  }

  const authProvider = new AppTokenAuthProvider(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
  _client = new ApiClient({ authProvider });
  return _client;
}

export interface TwitchUserInfo {
  id: string;
  login: string;
  displayName: string;
  profilePictureUrl: string;
}

/**
 * Validate that a Twitch user exists by login name.
 * Returns user info if found, `null` if not found.
 * Throws on network / rate‑limit errors (twurple auto‑retries on 429).
 */
export async function validateTwitchUser(
  loginName: string,
): Promise<TwitchUserInfo | null> {
  const client = getTwitchClient();
  if (!client) {
    logger.warn('Twitch API niedostępne – pomijam walidację użytkownika.');
    return null; // graceful degradation: skip validation if no credentials
  }

  const user = await client.users.getUserByName(loginName.toLowerCase().trim());
  if (!user) return null;

  return {
    id: user.id,
    login: user.name,
    displayName: user.displayName,
    profilePictureUrl: user.profilePictureUrl,
  };
}

/** Reset the singleton (for testing). */
export function _resetTwitchClient(): void {
  _client = null;
}
