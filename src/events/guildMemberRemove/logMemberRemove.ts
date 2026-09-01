import { GuildMember, AuditLogEvent, Client } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getAuditLogEntry, getModerator, getReason } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(member: GuildMember, client: Client): Promise<void> {
  try {
    const kickEntry = await getAuditLogEntry(member.guild, AuditLogEvent.MemberKick, member.id);

    if (kickEntry) {
      const moderator = await getModerator(member.guild, AuditLogEvent.MemberKick, member.id);
      const reason = await getReason(member.guild, AuditLogEvent.MemberKick, member.id);

      await sendLog(client, member.guild.id, 'memberKick', {
        title: null,
        description: `**👋 <@${member.id}> został wyrzucony.**`,
        fields: [
          ...(moderator ? [moderatorField(moderator.id)] : []),
          ...(reason ? [{ name: 'Powód:', value: reason, inline: true }] : []),
        ],
        authorName: member.user.tag,
        authorIcon: member.user.displayAvatarURL({ size: 64 }),
        thumbnail: member.user.displayAvatarURL({ size: 256 }),
      });
    } else {
      await sendLog(client, member.guild.id, 'memberLeave', {
        title: null,
        description: `**📤 Użytkownik <@${member.id}> opuścił serwer.**`,
        authorName: member.user.tag,
        authorIcon: member.user.displayAvatarURL({ size: 64 }),
        fields: [
          {
            name: '⏱️ Czas na serwerze',
            value: member.joinedAt
              ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`
              : 'Nieznany',
            inline: true,
          },
          {
            name: '🔢 Liczba członków',
            value: `${member.guild.memberCount}`,
            inline: true,
          },
        ],
      });
    }
  } catch (error) {
    logger.error(`[logMemberRemove] Error: ${error}`);
  }
}
