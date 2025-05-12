import { Channel, ChannelType, GuildChannel } from 'discord.js';
import { ChannelStatsModel } from '../../models/ChannelStats';
import logger from '../../utils/logger';

export default async function run(channel: Channel) {
  if (!('guild' in channel)) return;

  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildText) return;

  const guildChannel = channel as GuildChannel;
  try {
    const channelStats = await ChannelStatsModel.findOne({ guildId: guildChannel.guild.id });
    if (!channelStats) return;

    type StatsChannelKey = 'lastJoined' | 'users' | 'bots' | 'bans';

    const channelTypeMapping: Record<string, StatsChannelKey> = {
      newest: 'lastJoined',
      people: 'users',
      bots: 'bots',
      bans: 'bans',
    };

    const channelTypes = ['people', 'bots', 'bans', 'newest'];
    for (const type of channelTypes) {
      const propertyKey = channelTypeMapping[type];
      if (propertyKey && channelStats.channels?.[propertyKey]?.channelId === channel.id) {
        channelStats.channels[propertyKey] = { channelId: undefined };
      }
    }

    await channelStats.save();
  } catch (error) {
    logger.error(`Błąd podczas usuwania kanału statystyk: ${error}`);
  }
}
