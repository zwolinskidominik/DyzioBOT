import { Role, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(role: Role, client: Client): Promise<void> {
  try {
    const moderator = await getModerator(role.guild, AuditLogEvent.RoleCreate, role.id);

    await sendLog(client, role.guild.id, 'roleCreate', {
      title: null,
      description: `**🎭 Utworzono rolę <@&${role.id}>.**`,
      fields: [
        {
          name: 'Nazwa',
          value: role.name,
          inline: true,
        },
        {
          name: 'Kolor',
          value: role.hexColor,
          inline: true,
        },
        ...(moderator ? [moderatorField(moderator.id)] : []),
      ],
    });
  } catch (error) {
    logger.error(`[logRoleCreate] Error: ${error}`);
  }
}
