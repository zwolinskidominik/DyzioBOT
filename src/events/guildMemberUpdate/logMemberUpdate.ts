import { GuildMember, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldMember: GuildMember,
  newMember: GuildMember,
  client: Client
): Promise<void> {
  try {
    const ctx = { userId: newMember.id, member: newMember };

    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
      const moderator = await getModerator(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id
      );

      if (newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date()) {
        const until = Math.floor(newMember.communicationDisabledUntil.getTime() / 1000);
        await sendLog(client, newMember.guild.id, 'memberTimeout', {
          title: null,
          description: `**🔇 <@${newMember.id}> otrzymał timeout${moderator ? ` od <@${moderator.id}>` : ''}.**\n**Wygasa:** <t:${until}:R> (<t:${until}:F>)`,
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${newMember.id}`,
          timestamp: new Date(),
        }, ctx);
      } else {
        await sendLog(client, newMember.guild.id, 'memberTimeout', {
          title: null,
          description: `**🔊 Usunięto timeout dla <@${newMember.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
          authorName: newMember.user.tag,
          authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
          footer: `User ID: ${newMember.id}`,
          timestamp: new Date(),
        }, ctx);
      }
    }

    if (oldMember.nickname !== newMember.nickname) {
      await sendLog(client, newMember.guild.id, 'memberNicknameChange', {
        title: null,
        description: `**📝 <@${newMember.id}> zmienił pseudonim.**`,
        authorName: newMember.user.tag,
        authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        fields: [
          {
            name: '🔖 Poprzedni',
            value: oldMember.nickname || '*Brak*',
            inline: true,
          },
          {
            name: '🔖 Nowy',
            value: newMember.nickname || '*Brak*',
            inline: true,
          },
        ],
        footer: `User ID: ${newMember.id}`,
        timestamp: new Date(),
      }, ctx);
    }

    const addedRoles = newMember.roles.cache.filter(
      (role) => !oldMember.roles.cache.has(role.id)
    );
    const removedRoles = oldMember.roles.cache.filter(
      (role) => !newMember.roles.cache.has(role.id)
    );

    for (const role of addedRoles.values()) {
      await sendLog(client, newMember.guild.id, 'memberRoleAdd', {
        title: null,
        description: `**➕ <@${newMember.id}> otrzymał rolę <@&${role.id}>.**`,
        authorName: newMember.user.tag,
        authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        footer: `User ID: ${newMember.id} | Role ID: ${role.id}`,
        timestamp: new Date(),
      }, ctx);
    }

    for (const role of removedRoles.values()) {
      await sendLog(client, newMember.guild.id, 'memberRoleRemove', {
        title: null,
        description: `**➖ <@${newMember.id}> utracił rolę <@&${role.id}>.**`,
        authorName: newMember.user.tag,
        authorIcon: newMember.user.displayAvatarURL({ size: 64 }),
        footer: `User ID: ${newMember.id} | Role ID: ${role.id}`,
        timestamp: new Date(),
      }, ctx);
    }
  } catch (error) {
    logger.error(`[logMemberUpdate] Error: ${error}`);
  }
}
