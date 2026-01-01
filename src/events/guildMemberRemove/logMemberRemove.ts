import { GuildMember, AuditLogEvent, Client } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';

export default async function run(member: GuildMember, client: Client): Promise<void> {
  try {
    let kickEntry;
    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 5,
      });

      kickEntry = auditLogs.entries.find(
        (entry) =>
          entry.target?.id === member.id &&
          Date.now() - entry.createdTimestamp < 5000
      );
    } catch (auditError) {
      kickEntry = undefined;
    }

    if (kickEntry) {
      const moderator = await getModerator(member.guild, AuditLogEvent.MemberKick, member.id);
      const reason = kickEntry.reason || 'Brak powodu';

      await sendLog(client, member.guild.id, 'memberKick', {
        title: null,
        description: `**👋 <@${member.id}> został wyrzucony.**`,
        fields: [
          { 
            name: '**Moderator:**', 
            value: moderator ? `<@${moderator.id}>` : 'Nieznany', 
            inline: true 
          },
          { 
            name: '**Powód:**', 
            value: reason, 
            inline: true 
          },
        ],
        authorName: member.user.tag,
        authorIcon: member.user.displayAvatarURL({ size: 64 }),
        thumbnail: member.user.displayAvatarURL({ size: 256 }),
        footer: moderator ? moderator.username : 'Nieznany moderator',
        footerIcon: moderator?.displayAvatarURL(),
        timestamp: new Date(),
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
        footer: `User ID: ${member.id}`,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error('[logMemberRemove] Error:', error);
  }
}
