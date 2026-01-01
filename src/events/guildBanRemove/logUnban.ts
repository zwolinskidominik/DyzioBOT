import { GuildBan, AuditLogEvent, Client } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';

export default async function run(ban: GuildBan, client: Client): Promise<void> {
  const { guild, user } = ban;

  const moderator = await getModerator(guild, AuditLogEvent.MemberBanRemove, user.id);

  await sendLog(client, guild.id, 'memberUnban', {
    title: null,
    description: `**🛬 <@${user.id}> został odbanowany.**`,
    fields: moderator ? [{ name: '**Moderator:**', value: `<@${moderator.id}>`, inline: false }] : undefined,
    authorName: user.tag,
    authorIcon: user.displayAvatarURL(),
    thumbnail: user.displayAvatarURL({ size: 256 }),
    footer: moderator ? moderator.username : 'Nieznany moderator',
    footerIcon: moderator?.displayAvatarURL(),
    timestamp: new Date(),
  });
}
