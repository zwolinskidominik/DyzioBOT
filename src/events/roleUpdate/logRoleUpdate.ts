import { Role, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldRole: Role,
  newRole: Role,
  client: Client
): Promise<void> {
  try {
    const moderator = await getModerator(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    if (oldRole.name !== newRole.name) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano nazwę roli <@&${newRole.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '📝 Poprzednia nazwa', value: oldRole.name, inline: true },
          { name: '📝 Nowa nazwa', value: newRole.name, inline: true },
        ],
        footer: `Role ID: ${newRole.id}`,
        timestamp: new Date(),
      });
    }

    if (oldRole.color !== newRole.color) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano kolor roli <@&${newRole.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '🎨 Poprzedni kolor', value: oldRole.hexColor, inline: true },
          { name: '🎨 Nowy kolor', value: newRole.hexColor, inline: true },
        ],
        footer: `Role ID: ${newRole.id}`,
        timestamp: new Date(),
      });
    }

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano uprawnienia roli <@&${newRole.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        footer: `Role ID: ${newRole.id}`,
        timestamp: new Date(),
      });
    }

    if (oldRole.hoist !== newRole.hoist) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano wyświetlanie roli <@&${newRole.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**\n${newRole.hoist ? '**Rola jest teraz wyświetlana osobno.**' : '**Rola nie jest już wyświetlana osobno.**'}`,
        footer: `Role ID: ${newRole.id}`,
        timestamp: new Date(),
      });
    }

    if (oldRole.mentionable !== newRole.mentionable) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano możliwość oznaczania roli <@&${newRole.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**\n${newRole.mentionable ? '**Rola może być teraz oznaczana.**' : '**Rola nie może być już oznaczana.**'}`,
        footer: `Role ID: ${newRole.id}`,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    logger.error(`[logRoleUpdate] Error: ${error}`);
  }
}
