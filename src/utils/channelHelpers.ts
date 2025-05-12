import { Guild, TextChannel } from 'discord.js';
import { ChannelStatsModel } from '../models/ChannelStats';

export async function safeSetChannelName(
  channel: TextChannel,
  newName: string,
  retries = 3,
  delay = 1_000
): Promise<void> {
  try {
    await channel.setName(newName);
  } catch (error: unknown) {
    const e = error as { httpStatus?: number; code?: number };
    if (retries > 0 && (e.httpStatus === 429 || e.code === 50_013)) {
      console.warn(`Rate-limited przy zmianie nazwy, retry za ${delay} ms…`);
      await new Promise((r) => setTimeout(r, delay));
      return safeSetChannelName(channel, newName, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function updateChannelName(
  guild: Guild,
  channelConfig: { channelId?: string; template: string } | undefined,
  newValue: string | number
): Promise<void> {
  if (!channelConfig?.channelId) return;
  const channel = guild.channels.cache.get(channelConfig.channelId);
  if (!channel || !('setName' in channel)) return;

  const newName = channelConfig.template.replace(/<>/g, String(newValue));
  if ((channel as TextChannel).name !== newName) {
    await safeSetChannelName(channel as TextChannel, newName);
  }
}

export async function updateChannelStats(guild: Guild): Promise<void> {
  const channelStats = await ChannelStatsModel.findOne({ guildId: guild.id });
  if (!channelStats) return;

  try {
    const nonBotMembers = guild.members.cache.filter((m) => !m.user.bot);
    const botMembers = guild.members.cache.filter((m) => m.user.bot);

    const userCount = nonBotMembers.size;
    const botCount = botMembers.size;

    const newestMember = nonBotMembers
      .sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0))
      .first();
    const newestValue = newestMember?.user.username ?? 'Brak';

    let banCount = 0;
    try {
      banCount = (await guild.bans.fetch()).size;
    } catch (err) {
      console.error(`Błąd przy pobieraniu banów: ${err}`);
    }

    const tasks: Promise<void>[] = [];

    if (channelStats.channels.users)
      tasks.push(
        updateChannelName(
          guild,
          {
            ...channelStats.channels.users,
            template: channelStats.channels.users.template || '',
          },
          userCount
        )
      );

    if (channelStats.channels.bots)
      tasks.push(
        updateChannelName(
          guild,
          {
            ...channelStats.channels.bots,
            template: channelStats.channels.bots.template || '',
          },
          botCount
        )
      );

    if (channelStats.channels.bans)
      tasks.push(
        updateChannelName(
          guild,
          {
            ...channelStats.channels.bans,
            template: channelStats.channels.bans.template || '',
          },
          banCount
        )
      );

    if (channelStats.channels.lastJoined)
      tasks.push(
        updateChannelName(
          guild,
          {
            ...channelStats.channels.lastJoined,
            template: channelStats.channels.lastJoined.template || '',
          },
          newestValue
        ).then(() => {
          channelStats.channels.lastJoined!.member = newestMember?.id;
        })
      );

    await Promise.all(tasks);
    await channelStats.save();
  } catch (err) {
    console.error(`Błąd przy aktualizacji statystyk: ${err}`);
  }
}
