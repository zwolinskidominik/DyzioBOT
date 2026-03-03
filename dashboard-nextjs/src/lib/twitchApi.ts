/**
 * Server-side Twitch Helix API helpers for the dashboard.
 *
 * Uses the Client Credentials OAuth flow (app access token) to call
 * the Twitch Helix API directly via fetch — no @twurple dependency needed.
 *
 * Rate limits (Twitch Helix):
 *  - App access tokens: 800 requests / 60 seconds (shared across all calls)
 *  - Headers: Ratelimit-Limit, Ratelimit-Remaining, Ratelimit-Reset
 *  - On 429: respect Ratelimit-Reset or retry after 1 s
 */

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_HELIX_URL = 'https://api.twitch.tv/helix';

let _appToken: string | null = null;
let _tokenExpiresAt = 0;

/** Obtain or refresh an app access token via Client Credentials. */
async function getAppToken(): Promise<string> {
  if (_appToken && Date.now() < _tokenExpiresAt) return _appToken;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Brak TWITCH_CLIENT_ID lub TWITCH_CLIENT_SECRET w zmiennych środowiskowych.');
  }

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch token error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _appToken = data.access_token;
  // Refresh 5 minutes before actual expiry
  _tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return _appToken;
}

export interface TwitchUserInfo {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

/**
 * Validate that a Twitch user exists.
 * Returns user info or `null` if not found.
 * Handles rate limits with a single retry after the reset window.
 */
export async function validateTwitchUser(
  login: string,
): Promise<TwitchUserInfo | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null; // graceful degradation

  const token = await getAppToken();

  const res = await fetch(
    `${TWITCH_HELIX_URL}/users?login=${encodeURIComponent(login.toLowerCase().trim())}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
    },
  );

  // Handle rate limit (429)
  if (res.status === 429) {
    const resetEpoch = res.headers.get('Ratelimit-Reset');
    const waitMs = resetEpoch
      ? Math.max(0, Number(resetEpoch) * 1000 - Date.now()) + 100
      : 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    // Single retry
    return validateTwitchUser(login);
  }

  if (!res.ok) {
    // Token expired? Clear and retry once.
    if (res.status === 401) {
      _appToken = null;
      _tokenExpiresAt = 0;
      return validateTwitchUser(login);
    }
    throw new Error(`Twitch API error: ${res.status}`);
  }

  const body = await res.json() as { data: TwitchUserInfo[] };
  return body.data.length > 0 ? body.data[0] : null;
}
