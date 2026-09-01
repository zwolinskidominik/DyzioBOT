import { Role, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(role: Role, client: Client): Promise<void> {
  try {
    const moderator = await getModerator(role.guild, AuditLogEvent.RoleDelete, role.id);

    await sendLog(client, role.guild.id, 'roleDelete', {
      title: null,
      description: `**🗑️ Usunięto rolę \`${role.name}\`.**`,
      fields: [
        {
          name: 'Kolor',
          value: role.hexColor,
          inline: true,
        },
        ...(moderator ? [moderatorField(moderator.id)] : []),
      ],
    });
  } catch (error) {
    logger.error(`[logRoleDelete] Error: ${error}`);
  }
}
