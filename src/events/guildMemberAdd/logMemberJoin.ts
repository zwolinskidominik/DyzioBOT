import { GuildMember, Client } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import logger from '../../utils/logger';

export default async function run(member: GuildMember, client: Client): Promise<void> {
  try {
    await sendLog(client, member.guild.id, 'memberJoin', {
      title: null,
      description: `**📥 Użytkownik <@${member.id}> dołączył do serwera.**`,
      authorName: member.user.tag,
      authorIcon: member.user.displayAvatarURL({ size: 64 }),
      fields: [
        {
          name: '👤 Konto utworzone',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: '🔢 Liczba członków',
          value: `${member.guild.memberCount}`,
          inline: true,
        },
      ],
      footer: `User ID: ${member.id}`,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(`[logMemberJoin] Error: ${error}`);
  }
}
