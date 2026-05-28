"use client";

import { fetchWithAuth } from './fetchWithAuth';
import { toSortedDiscordChannels, toSortedDiscordRoles } from './discordOrdering';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;

class GuildDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  private getCacheKey(guildId: string, type: 'channels' | 'roles' | 'members'): string {
    return `${guildId}:${type}`;
  }

  get<T>(guildId: string, type: 'channels' | 'roles' | 'members'): T | null {
    const key = this.getCacheKey(guildId, type);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(guildId: string, type: 'channels' | 'roles' | 'members', data: T): void {
    const key = this.getCacheKey(guildId, type);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(guildId: string, type?: 'channels' | 'roles' | 'members'): void {
    if (type) {
      const key = this.getCacheKey(guildId, type);
      this.cache.delete(key);
    } else {
      const prefix = `${guildId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const guildCache = new GuildDataCache();

function normalizeGuildData<T>(type: 'channels' | 'roles' | 'members', data: unknown): T {
  if (type === 'channels') return toSortedDiscordChannels(data) as T;
  if (type === 'roles') return toSortedDiscordRoles(data) as T;
  return data as T;
}

// Tracks in-flight prefetch promises to prevent duplicate concurrent requests.
const inflightPrefetch = new Map<string, Promise<void>>();

export async function fetchGuildData<T>(
  guildId: string,
  type: 'channels' | 'roles' | 'members',
  apiPath: string
): Promise<T> {
  const cached = guildCache.get<T>(guildId, type);
  if (cached) {
    return normalizeGuildData<T>(type, cached);
  }

  if (type === 'channels' || type === 'roles') {
    try {
      const bulkResponse = await fetchWithAuth(
        `/api/discord/guild/${guildId}/bulk?include=channels,roles`,
        { next: { revalidate: 300 } }
      );

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        
        if (bulkData.channels) {
          guildCache.set(guildId, 'channels', toSortedDiscordChannels(bulkData.channels));
        }
        if (bulkData.roles) {
          guildCache.set(guildId, 'roles', toSortedDiscordRoles(bulkData.roles));
        }
        
        return normalizeGuildData<T>(type, bulkData[type]);
      }
    } catch (error) {
      console.warn(`Bulk endpoint failed for ${type}`);
    }
  }

  const response = await fetchWithAuth(apiPath, { 
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5000)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type}`);
  }

  const data = normalizeGuildData<T>(type, await response.json());
  guildCache.set(guildId, type, data);
  
  return data;
}

async function _doPrefetch(
  guildId: string,
  uncachedTypes: Array<'channels' | 'roles' | 'members'>
): Promise<void> {
  const bulkTypes = uncachedTypes.filter(t => t === 'channels' || t === 'roles');
  const memberType = uncachedTypes.find(t => t === 'members');

  const promises: Promise<any>[] = [];

  if (bulkTypes.length > 0) {
    promises.push(
      fetchWithAuth(`/api/discord/guild/${guildId}/bulk?include=channels,roles`, {
        next: { revalidate: 300 }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.channels) guildCache.set(guildId, 'channels', toSortedDiscordChannels(data.channels));
          if (data?.roles) guildCache.set(guildId, 'roles', toSortedDiscordRoles(data.roles));
        })
        .catch(err => console.debug('Bulk prefetch failed:', err))
    );
  }

  if (memberType) {
    promises.push(
      fetchWithAuth(`/api/discord/guild/${guildId}/members`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(7000)
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) guildCache.set(guildId, 'members', data);
        })
        .catch(err => console.debug('Members prefetch failed:', err))
    );
  }

  await Promise.allSettled(promises);
}

export function prefetchGuildData(
  guildId: string,
  types: Array<'channels' | 'roles' | 'members'>
): void {
  const uncachedTypes = types.filter(type => !guildCache.get(guildId, type));
  if (uncachedTypes.length === 0) return;

  const inflightKey = `${guildId}:${uncachedTypes.sort().join(',')}`;
  if (inflightPrefetch.has(inflightKey)) return;

  const promise = _doPrefetch(guildId, uncachedTypes).finally(() => {
    inflightPrefetch.delete(inflightKey);
  });
  inflightPrefetch.set(inflightKey, promise);
}
