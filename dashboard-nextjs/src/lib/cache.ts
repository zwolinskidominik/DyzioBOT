"use client";

import { fetchWithAuth } from './fetchWithAuth';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - prevents Discord rate limits

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

export async function fetchGuildData<T>(
  guildId: string,
  type: 'channels' | 'roles' | 'members',
  apiPath: string
): Promise<T> {
  const cached = guildCache.get<T>(guildId, type);
  if (cached) {
    return cached;
  }

  // Always use bulk endpoint for channels and roles (single request!)
  if (type === 'channels' || type === 'roles') {
    try {
      // Fetch both channels AND roles in one go
      const bulkResponse = await fetchWithAuth(
        `/api/discord/guild/${guildId}/bulk?include=channels,roles`,
        { next: { revalidate: 300 } }
      );

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        
        // Cache both immediately
        if (bulkData.channels) {
          guildCache.set(guildId, 'channels', bulkData.channels);
        }
        if (bulkData.roles) {
          guildCache.set(guildId, 'roles', bulkData.roles);
        }
        
        return bulkData[type] as T;
      }
    } catch (error) {
      console.warn(`Bulk endpoint failed for ${type}`);
    }
  }

  // For members or fallback, use individual endpoint
  const response = await fetchWithAuth(apiPath, { 
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5000) // 5s timeout
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type}`);
  }

  const data = await response.json();
  guildCache.set(guildId, type, data);
  
  return data;
}

export async function prefetchGuildData(
  guildId: string,
  types: Array<'channels' | 'roles' | 'members'>
): Promise<void> {
  const uncachedTypes = types.filter(type => !guildCache.get(guildId, type));
  
  if (uncachedTypes.length === 0) {
    return; // Everything already cached!
  }

  const bulkTypes = uncachedTypes.filter(t => t === 'channels' || t === 'roles');
  const memberType = uncachedTypes.find(t => t === 'members');

  const promises: Promise<any>[] = [];

  // Single bulk request for channels + roles
  if (bulkTypes.length > 0) {
    promises.push(
      fetchWithAuth(`/api/discord/guild/${guildId}/bulk?include=channels,roles`, {
        next: { revalidate: 300 }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.channels) guildCache.set(guildId, 'channels', data.channels);
          if (data?.roles) guildCache.set(guildId, 'roles', data.roles);
        })
        .catch(err => console.debug('Bulk prefetch failed:', err))
    );
  }

  // Separate request for members (can be large)
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
