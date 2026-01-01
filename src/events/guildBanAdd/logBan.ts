import { GuildBan, AuditLogEvent, Client } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator, getReason } from '../../utils/auditLogHelpers';

export default async function run(ban: GuildBan, client: Client): Promise<void> {
  const { guild, user } = ban;

  const moderator = await getModerator(guild, AuditLogEvent.MemberBanAdd, user.id);
  const reason = await getReason(guild, AuditLogEvent.MemberBanAdd, user.id);

  await sendLog(client, guild.id, 'memberBan', {
    description: `🔨 Użytkownik <@${user.id}> został zbanowany${moderator ? ` przez <@${moderator.id}>` : ''}.${reason ? `\n**Powód:** ${reason}` : ''}`,
    authorName: user.tag,
    authorIcon: user.displayAvatarURL(),
    footer: `User ID: ${user.id}`,
  });
}
