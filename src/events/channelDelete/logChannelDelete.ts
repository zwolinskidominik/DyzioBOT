import { DMChannel, GuildChannel, Client, ChannelType, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(channel: DMChannel | GuildChannel, client: Client): Promise<void> {
  try {
    if (!('guild' in channel)) return;

    const moderator = await getModerator(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

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

    await sendLog(client, channel.guild.id, 'channelDelete', {
      title: null,
      description: `**🗑️ Usunięto kanał \`${channel.name}\`${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
      fields: [
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
    logger.error(`[logChannelDelete] Error: ${error}`);
  }
}
