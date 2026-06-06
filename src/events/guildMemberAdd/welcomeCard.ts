import { GuildMember } from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import {
  GREETING_DEFAULT_COLORS,
  buildGreetingMessage,
} from '../../utils/greetingMessageBuilder';
import logger from '../../utils/logger';

const DEFAULT_WELCOME_MESSAGE =
  `### Witaj {user} na {server}\n\n` +
  `**Witamy na pokładzie!**\n` +
  `Gratulacje, właśnie wbiłeś/aś do miejsca, w którym gry są poważniejsze niż życie… prawie.\n\n` +
  `➔ Przeczytaj {rulesChannel}\n` +
  `➔ Wybierz role {rolesChannel}\n` +
  `➔ Przywitaj się z nami {chatChannel}\n\n` +
  `**Rozgość się i znajdź ekipę do grania.**`;

const DEFAULT_DM_MESSAGE =
  `Cześć {username}, witaj na {server}!\n\n` +
  `Zajrzyj na {rulesChannel}, dobierz role na {rolesChannel} i śmiało wskakuj na {chatChannel}.`;

export default async function run(member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    if (!guild) return;

    const config = await GreetingsConfigurationModel.findOne({ guildId: guild.id });
    if (!config?.greetingsChannelId || !config.welcomeEnabled) return;

    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel || !('send' in channel)) return;

    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember) return;

    const permissions = channel.permissionsFor(botMember);
    const welcomeUsesEmbed = (config.welcomeMessageMode || 'embed') === 'embed';
    if (!permissions?.has('SendMessages') || (welcomeUsesEmbed && !permissions.has('EmbedLinks'))) {
      logger.debug('Bot cannot send welcome message in channel', { guildId: guild.id, channelId: channel.id });
      return;
    }

    const welcomeMessage = await buildGreetingMessage({
      member,
      config,
      moduleKey: 'welcome',
      defaultMessage: DEFAULT_WELCOME_MESSAGE,
      defaultTitle: 'Witaj na {server}',
      defaultColor: GREETING_DEFAULT_COLORS.welcome,
      mentionUser: true,
    });

    if (welcomeMessage.payload.files && !permissions.has('AttachFiles')) {
      logger.debug('Bot cannot attach welcome assets in channel', { guildId: guild.id, channelId: channel.id });
      return;
    }

    await channel.send(welcomeMessage.payload);

    if (config.dmEnabled) {
      try {
        const dmMessage = await buildGreetingMessage({
          member,
          config,
          moduleKey: 'dm',
          defaultMessage: DEFAULT_DM_MESSAGE,
          defaultTitle: 'Witaj na {server}',
          defaultColor: GREETING_DEFAULT_COLORS.dm,
          directMessage: true,
        });

        await member.send(dmMessage.payload);
      } catch (dmError) {
        logger.debug('Cannot send greeting DM to member', { guildId: guild.id, userId: member.user.id, error: dmError });
      }
    }
  } catch (error) {
    logger.error('Failed to handle welcome card', { userId: member?.user?.id, error });
  }
}
