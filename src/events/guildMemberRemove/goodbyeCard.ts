import { GuildMember } from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import {
  GREETING_DEFAULT_COLORS,
  buildGreetingMessage,
} from '../../utils/greetingMessageBuilder';
import logger from '../../utils/logger';

const DEFAULT_GOODBYE_MESSAGE = 'Dziękujemy za wspólnie spędzony czas. Do zobaczenia!';

export default async function run(member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    if (!guild) return;

    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    const channelId = config?.goodbyeChannelId || config?.greetingsChannelId;
    if (!config || !channelId || !config.goodbyeEnabled) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) return;

    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember) return;

    const permissions = channel.permissionsFor(botMember);
    const goodbyeUsesEmbed = (config.goodbyeMessageMode || 'embed') === 'embed';
    if (!permissions?.has('SendMessages') || (goodbyeUsesEmbed && !permissions.has('EmbedLinks'))) {
      logger.debug('Bot cannot send goodbye message in channel', { guildId: guild.id, channelId: channel.id });
      return;
    }

    const goodbyeMessage = await buildGreetingMessage({
      member,
      config,
      moduleKey: 'goodbye',
      defaultMessage: DEFAULT_GOODBYE_MESSAGE,
      defaultTitle: 'Do zobaczenia, {username}',
      defaultColor: GREETING_DEFAULT_COLORS.goodbye,
    });

    if (goodbyeMessage.payload.files && !permissions.has('AttachFiles')) {
      logger.debug('Bot cannot attach goodbye assets in channel', { guildId: guild.id, channelId: channel.id });
      return;
    }

    await channel.send(goodbyeMessage.payload);
  } catch (error) {
    logger.error('Failed to handle goodbye card', { userId: member?.user?.id, error });
  }
}
