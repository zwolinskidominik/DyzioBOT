import { ThreadChannel, Client, AuditLogEvent } from 'discord.js';
import { sendLog } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import logger from '../../utils/logger';

export default async function run(thread: ThreadChannel, _newlyCreated: boolean, client: Client): Promise<void> {
  try {
    if (!thread.guild) {
      logger.warn('[logThreadCreate] Thread guild is undefined');
      return;
    }

    const moderator = await getModerator(thread.guild, AuditLogEvent.ThreadCreate, thread.id);

    await sendLog(client, thread.guild.id, 'threadCreate', {
      title: null,
      description: `**🧵 Utworzono wątek <#${thread.id}>${moderator ? ` przez <@${moderator.id}>` : ''}.**`,
      fields: [
        {
          name: '📝 Nazwa',
          value: thread.name,
          inline: true,
        },
        {
          name: '📁 Kanał nadrzędny',
          value: `<#${thread.parentId}>`,
          inline: true,
        },
      ],
      footer: `Thread ID: ${thread.id}`,
      timestamp: new Date(),
    }, thread.parentId ? { channelId: thread.parentId } : undefined);
  } catch (error) {
    logger.error(`[logThreadCreate] Error: ${error}`);
  }
}
