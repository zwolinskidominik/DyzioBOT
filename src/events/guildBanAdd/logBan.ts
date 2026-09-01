import { GuildBan, AuditLogEvent, Client } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator, getReason } from '../../utils/auditLogHelpers';

export default async function run(ban: GuildBan, client: Client): Promise<void> {
  const { guild, user } = ban;

  const moderator = await getModerator(guild, AuditLogEvent.MemberBanAdd, user.id);
  const reason = await getReason(guild, AuditLogEvent.MemberBanAdd, user.id);

  const fields = moderator ? [moderatorField(moderator.id)] : [];
  if (reason) fields.push({ name: 'Powód:', value: reason, inline: true });

  await sendLog(client, guild.id, 'memberBan', {
    title: null,
    description: `**✈️ <@${user.id}> został zbanowany na serwerze.**`,
    fields,
    authorName: user.tag,
    authorIcon: user.displayAvatarURL(),
    thumbnail: user.displayAvatarURL(),
  });
}
