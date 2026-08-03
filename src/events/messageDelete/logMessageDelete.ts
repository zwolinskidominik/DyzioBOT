import { Message, PartialMessage, AuditLogEvent, Client } from 'discord.js';
import { sendLog, truncate } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import { deleteSuggestionByMessageId } from '../../services/suggestionService';
import logger from '../../utils/logger';

export default async function run(
  message: Message | PartialMessage,
  client: Client
): Promise<void> {
  if (!message.guild) return;
  
  if (message.author?.bot) return;

  try {
    await deleteSuggestionByMessageId(message.id);
  } catch (error) {
    logger.error(`[Suggestion] Błąd podczas usuwania sugestii z bazy danych: ${error}`);
  }

  const moderator = await getModerator(
    message.guild,
    AuditLogEvent.MessageDelete,
    message.author?.id
  );

  const content = message.content || '*Brak treści (możliwe embedy/attachmenty)*';
  const attachments = message.attachments?.size
    ? `\n**Załączniki (${message.attachments.size}):** ${message.attachments.map(a => a.url).join(', ')}`
    : '';

  await sendLog(client, message.guild.id, 'messageDelete', {
    title: null,
    description: `**🗑️ Wiadomość wysłana przez ${message.author ? `<@${message.author.id}>` : '**Nieznany**'} została usunięta na kanale <#${message.channelId}>.**${moderator ? `\n**Usunięte przez:** <@${moderator.id}>` : ''}\n\n\`\`\`${truncate(content, 994)}\`\`\`${attachments}`,
    authorName: message.author?.tag || 'Nieznany',
    authorIcon: message.author?.displayAvatarURL(),
    footer: `Message ID: ${message.id}`,
  }, { channelId: message.channelId, userId: message.author?.id });
}
