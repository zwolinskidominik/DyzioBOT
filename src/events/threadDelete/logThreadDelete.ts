import { ThreadChannel, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(thread: ThreadChannel, client: Client): Promise<void> {
  try {
    const moderator = await getModerator(thread.guild, AuditLogEvent.ThreadDelete, thread.id);

    await sendLog(client, thread.guild.id, 'threadDelete', {
      title: null,
      description: `**🗑️ Usunięto wątek \`${thread.name}\`.**`,
      fields: [
        {
          name: 'Kanał nadrzędny',
          value: `<#${thread.parentId}>`,
          inline: true,
        },
        ...(moderator ? [moderatorField(moderator.id)] : []),
      ],
    }, thread.parentId ? { channelId: thread.parentId } : undefined);
  } catch (error) {
    logger.error(`[logThreadDelete] Error: ${error}`);
  }
}
