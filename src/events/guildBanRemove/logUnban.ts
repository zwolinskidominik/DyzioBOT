import { GuildBan, AuditLogEvent, Client } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';

export default async function run(ban: GuildBan, client: Client): Promise<void> {
  const { guild, user } = ban;

  const moderator = await getModerator(guild, AuditLogEvent.MemberBanRemove, user.id);

  await sendLog(client, guild.id, 'memberUnban', {
    title: null,
    description: `**🛬 <@${user.id}> został odbanowany.**`,
    fields: moderator ? [moderatorField(moderator.id)] : [],
    authorName: user.tag,
    authorIcon: user.displayAvatarURL(),
    thumbnail: user.displayAvatarURL({ size: 256 }),
  });
}
