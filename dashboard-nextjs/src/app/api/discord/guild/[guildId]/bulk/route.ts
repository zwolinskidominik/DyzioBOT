import { NextResponse } from "next/server";
import { quickAuthCheck } from "@/lib/auth";
import { getFromCache, setInCache } from "@/lib/serverCache";
import { toSortedDiscordChannels, toSortedDiscordRoles } from "@/lib/discordOrdering";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_TTL = 5 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const auth = await quickAuthCheck(request);
    if (!auth.authorized) {
      return auth.response!;
    }

    const { guildId } = await params;

    const url = new URL(request.url);
    const include = url.searchParams.get('include')?.split(',') || ['channels', 'roles'];

    const results = await Promise.allSettled([
      include.includes('channels') ? fetchChannels(guildId) : Promise.resolve(null),
      include.includes('roles') ? fetchRoles(guildId) : Promise.resolve(null),
      include.includes('members') ? fetchMembers(guildId) : Promise.resolve(null),
    ]);

    const response: Record<string, unknown> = {};

    if (include.includes('channels')) {
      const channelsResult = results[0];
      response.channels = channelsResult.status === 'fulfilled' ? channelsResult.value : null;
    }

    if (include.includes('roles')) {
      const rolesResult = results[1];
      response.roles = rolesResult.status === 'fulfilled' ? rolesResult.value : null;
    }

    if (include.includes('members')) {
      const membersResult = results[2];
      response.members = membersResult.status === 'fulfilled' ? membersResult.value : null;
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'public, s-maxage=300',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=300',
      },
    });
  } catch (error) {
    console.error("Error in bulk fetch:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchChannels(guildId: string) {
  const cached = await getFromCache<unknown>('channels', guildId);
  if (cached) return toSortedDiscordChannels(cached);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);

    const data = toSortedDiscordChannels(await response.json());
    await setInCache('channels', guildId, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Channels fetch error:', message);
    
    const stale = await getFromCache<unknown>('channels', guildId, true);
    if (stale) {
      console.log('Using stale cache for channels');
      return toSortedDiscordChannels(stale);
    }
    
    throw error;
  }
}

async function fetchRoles(guildId: string) {
  const cached = await getFromCache<unknown>('roles', guildId);
  if (cached) return toSortedDiscordRoles(cached);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);

    const data = toSortedDiscordRoles(await response.json());
    await setInCache('roles', guildId, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Roles fetch error:', message);
    
    const stale = await getFromCache<unknown>('roles', guildId, true);
    if (stale) {
      console.log('Using stale cache for roles');
      return toSortedDiscordRoles(stale);
    }
    
    throw error;
  }
}

async function fetchMembers(guildId: string) {
  const cached = await getFromCache<any>('members', guildId);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);

    const members = await response.json();
    
    const simplified = members.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      discriminator: m.user.discriminator,
      avatar: m.user.avatar,
      nickname: m.nick,
    }));

    await setInCache('members', guildId, simplified);
    return simplified;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Members fetch error:', error.message);
    
    const stale = await getFromCache<any>('members', guildId, true);
    if (stale) {
      console.log('Using stale cache for members');
      return stale;
    }
    
    throw error;
  }
}
