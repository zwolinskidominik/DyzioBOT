import { Role, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldRole: Role,
  newRole: Role,
  client: Client
): Promise<void> {
  try {
    const moderator = await getModerator(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const modFields = moderator ? [moderatorField(moderator.id)] : [];

    if (oldRole.name !== newRole.name) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano nazwę roli <@&${newRole.id}>.**`,
        fields: [
          { name: 'Stara nazwa', value: oldRole.name, inline: true },
          { name: 'Nowa nazwa', value: newRole.name, inline: true },
          ...modFields,
        ],
      });
    }

    if (oldRole.color !== newRole.color) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano kolor roli <@&${newRole.id}>.**`,
        fields: [
          { name: 'Stary kolor', value: oldRole.hexColor, inline: true },
          { name: 'Nowy kolor', value: newRole.hexColor, inline: true },
          ...modFields,
        ],
      });
    }

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano uprawnienia roli <@&${newRole.id}>.**`,
        fields: modFields,
      });
    }

    if (oldRole.hoist !== newRole.hoist) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano wyświetlanie roli <@&${newRole.id}>.**\n${newRole.hoist ? '**Rola jest teraz wyświetlana osobno.**' : '**Rola nie jest już wyświetlana osobno.**'}`,
        fields: modFields,
      });
    }

    if (oldRole.mentionable !== newRole.mentionable) {
      await sendLog(client, newRole.guild.id, 'roleUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano możliwość oznaczania roli <@&${newRole.id}>.**\n${newRole.mentionable ? '**Rola może być teraz oznaczana.**' : '**Rola nie może być już oznaczana.**'}`,
        fields: modFields,
      });
    }
  } catch (error) {
    logger.error(`[logRoleUpdate] Error: ${error}`);
  }
}
