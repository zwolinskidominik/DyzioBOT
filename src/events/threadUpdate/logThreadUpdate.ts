import { ThreadChannel, Client, AuditLogEvent } from 'discord.js';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(
  oldThread: ThreadChannel,
  newThread: ThreadChannel,
  client: Client
): Promise<void> {
  try {
    const ctx = newThread.parentId ? { channelId: newThread.parentId } : undefined;

    const moderator = await getModerator(newThread.guild, AuditLogEvent.ThreadUpdate, newThread.id);
    const modFields = moderator ? [moderatorField(moderator.id)] : [];

    if (oldThread.name !== newThread.name) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano nazwę wątku <#${newThread.id}>.**`,
        fields: [
          { name: 'Stara nazwa', value: oldThread.name, inline: true },
          { name: 'Nowa nazwa', value: newThread.name, inline: true },
          ...modFields,
        ],
      }, ctx);
    }

    if (oldThread.archived !== newThread.archived) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: newThread.archived
          ? `**📦 Wątek <#${newThread.id}> został zarchiwizowany.**`
          : `**📂 Wątek <#${newThread.id}> został odarchiwizowany.**`,
        fields: modFields,
      }, ctx);
    }

    if (oldThread.locked !== newThread.locked) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: newThread.locked
          ? `**🔒 Wątek <#${newThread.id}> został zamknięty.**`
          : `**🔓 Wątek <#${newThread.id}> został otwarty.**`,
        fields: modFields,
      }, ctx);
    }
  } catch (error) {
    logger.error(`[logThreadUpdate] Error: ${error}`);
  }
}
