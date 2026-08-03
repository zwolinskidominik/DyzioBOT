import { ThreadChannel, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
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

    if (oldThread.name !== newThread.name) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: `**✏️ Zaktualizowano nazwę wątku <#${newThread.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        fields: [
          { name: '📝 Poprzednia nazwa', value: oldThread.name, inline: true },
          { name: '📝 Nowa nazwa', value: newThread.name, inline: true },
        ],
        footer: `Thread ID: ${newThread.id}`,
        timestamp: new Date(),
      }, ctx);
    }

    if (oldThread.archived !== newThread.archived) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: newThread.archived
          ? `**📦 Wątek <#${newThread.id}> został zarchiwizowany${moderator ? ` przez <@${moderator.id}>` : ''}.**`
          : `**📂 Wątek <#${newThread.id}> został odarchiwizowany${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        footer: `Thread ID: ${newThread.id}`,
        timestamp: new Date(),
      }, ctx);
    }

    if (oldThread.locked !== newThread.locked) {
      await sendLog(client, newThread.guild.id, 'threadUpdate', {
        title: null,
        description: newThread.locked
          ? `**🔒 Wątek <#${newThread.id}> został zamknięty${moderator ? ` przez <@${moderator.id}>` : ''}.**`
          : `**🔓 Wątek <#${newThread.id}> został otwarty${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
        footer: `Thread ID: ${newThread.id}`,
        timestamp: new Date(),
      }, ctx);
    }
  } catch (error) {
    logger.error(`[logThreadUpdate] Error: ${error}`);
  }
}
