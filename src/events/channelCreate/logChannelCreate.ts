import { GuildChannel, Client, ChannelType, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(channel: GuildChannel, client: Client): Promise<void> {
  try {
    const moderator = await getModerator(channel.guild, AuditLogEvent.ChannelCreate, channel.id);

    const channelTypeNames: Partial<Record<ChannelType, string>> = {
      [ChannelType.GuildText]: 'Tekstowy',
      [ChannelType.GuildVoice]: 'Głosowy',
      [ChannelType.GuildCategory]: 'Kategoria',
      [ChannelType.GuildAnnouncement]: 'Ogłoszenia',
      [ChannelType.AnnouncementThread]: 'Wątek ogłoszeń',
      [ChannelType.PublicThread]: 'Wątek publiczny',
      [ChannelType.PrivateThread]: 'Wątek prywatny',
      [ChannelType.GuildStageVoice]: 'Stage',
      [ChannelType.GuildForum]: 'Forum',
      [ChannelType.GuildMedia]: 'Media',
    };

    await sendLog(client, channel.guild.id, 'channelCreate', {
      title: null,
      description: `**📁 Utworzono kanał <#${channel.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
      fields: [
        {
          name: '📝 Nazwa',
          value: channel.name,
          inline: true,
        },
        {
          name: '🔖 Typ',
          value: channelTypeNames[channel.type] || 'Nieznany',
          inline: true,
        },
      ],
      footer: `Channel ID: ${channel.id}`,
      timestamp: new Date(),
    }, { channelId: channel.id });
  } catch (error) {
    logger.error(`[logChannelCreate] Error: ${error}`);
  }
}
