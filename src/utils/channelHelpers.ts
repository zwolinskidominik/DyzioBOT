import { Collection, Guild, GuildChannel, GuildMember, TextChannel } from 'discord.js';
import { ChannelStatsModel } from '../models/ChannelStats';
import logger from './logger';

const renameTokens = new Map<string, number>();
let renameSeq = 0;

export async function safeSetChannelName(
  channel: GuildChannel,
  newName: string,
  retries = 3,
  delay = 1_000
): Promise<void> {
  if (channel.name === newName) return;
  const chanId = channel.id ?? '';
  const myToken = ++renameSeq;
  renameTokens.set(chanId, myToken);

  const attempt = async (left: number, nextDelay: number): Promise<void> => {
    if (renameTokens.get(chanId) !== myToken) return;
    try {
      await channel.setName(newName);
    } catch (error: unknown) {
      const e = error as { httpStatus?: number; code?: number };
      if (e.code === 50_013) {
        logger.warn(`Brak uprawnień do zmiany nazwy kanału ${channel.id}`);
        return;
      }
      if (left > 0 && e?.httpStatus === 429) {
        logger.warn(
          `Rate-limit przy zmianie nazwy kanału ${channel.id}. Retry za ${nextDelay} ms (pozostało ${left}).`
        );
        await new Promise((r) => setTimeout(r, nextDelay));
        if (renameTokens.get(chanId) !== myToken) return;
        return attempt(left - 1, Math.min(nextDelay * 2, 30_000));
      }
      throw error;
    }
  };

  await attempt(retries, delay);
}

export interface SimpleChannelConfig {
  channelId?: string;
  template?: string;
  member?: string;
}

function buildChannelName(template: string | undefined, value: string | number): string {
  if (!template) return String(value);
  return template
    .replace(/{count}/g, String(value))
    .replace(/<count>/g, String(value))
    .replace(/{value}/g, String(value))
    .replace(/<value>/g, String(value))
    .replace(/{member}/g, String(value))
    .replace(/<member>/g, String(value))
    .replace(/<>/g, String(value))
    .slice(0, 100);
}

export async function updateChannelName(
  guild: Guild,
  channelConfig: SimpleChannelConfig | undefined,
  newValue: string | number
): Promise<void> {
  if (!channelConfig?.channelId) return;
  const channel = guild.channels.cache.get(channelConfig.channelId);
  if (
    !channel ||
    !('setName' in channel) ||
    !('name' in channel)
  )
    return;

  const newName = buildChannelName(channelConfig.template, newValue);
  await safeSetChannelName(channel as TextChannel, newName);
}

const BAN_CACHE_TTL = 10 * 60 * 1000;
const banCache = new Map<string, { count: number; timestamp: number }>();

const MEMBER_FETCH_TTL = 5 * 60 * 1000;
const lastMemberFetch = new Map<string, number>();

async function ensureFreshMembers(guild: Guild): Promise<void> {
  const incomplete = guild.members.cache.size < guild.memberCount;
  const now = Date.now();
  const last = lastMemberFetch.get(guild.id) ?? 0;

  if (!incomplete) return;
  if (now - last < MEMBER_FETCH_TTL) return;

  try {
    await guild.members.fetch();
    lastMemberFetch.set(guild.id, now);
  } catch (err) {
    logger.warn(`Nie udało się pobrać pełnej listy członków guild=${guild.id}: ${err}`);
  }
}

function computeNewestMember(
  members: Collection<string, GuildMember>
): GuildMember | undefined {
  let newest: GuildMember | undefined;
  let newestTs = -1;
  for (const m of members.values()) {
    const ts = m.joinedTimestamp ?? 0;
    if (ts > newestTs) {
      newestTs = ts;
      newest = m;
    }
  }
  return newest;
}

async function getBanCount(guild: Guild): Promise<number> {
  const cached = banCache.get(guild.id);
  const now = Date.now();
  if (cached && now - cached.timestamp < BAN_CACHE_TTL) return cached.count;
  try {
    const bans = await guild.bans.fetch();
    const count = bans.size;
    banCache.set(guild.id, { count, timestamp: now });
    return count;
  } catch (err) {
    logger.error(`Błąd przy pobieraniu banów dla guild=${guild.id}: ${err}`);
    return cached?.count ?? 0;
  }
}

export async function updateChannelStats(guild: Guild): Promise<void> {
  const channelStats = await ChannelStatsModel.findOne({ guildId: guild.id });
  if (!channelStats) return;

  try {
    await ensureFreshMembers(guild);

    const membersCache = guild.members.cache;
    const nonBotMembers = membersCache.filter((m) => !m.user.bot);
    const botMembers = membersCache.filter((m) => m.user.bot);

    const userCount = nonBotMembers.size;
    const botCount = botMembers.size;

    const newestMember = computeNewestMember(membersCache);
    const newestValue = newestMember?.user.username ?? 'Brak';

    const banCount = await getBanCount(guild);

    const tasks: Promise<void>[] = [];

    if (channelStats.channels.users) {
      tasks.push(updateChannelName(guild, channelStats.channels.users, userCount));
    }
    if (channelStats.channels.bots) {
      tasks.push(updateChannelName(guild, channelStats.channels.bots, botCount));
    }
    if (channelStats.channels.bans) {
      tasks.push(updateChannelName(guild, channelStats.channels.bans, banCount));
    }
    if (channelStats.channels.lastJoined) {
      tasks.push(
        updateChannelName(guild, channelStats.channels.lastJoined, newestValue).then(() => {
          channelStats.channels.lastJoined!.member = newestMember?.id;
        })
      );
    }

    await Promise.all(tasks);
    await channelStats.save();
  } catch (err) {
    logger.error(`Błąd przy aktualizacji statystyk (guild=${guild.id}): ${err}`);
  }
}
