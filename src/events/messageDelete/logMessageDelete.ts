import { Message, PartialMessage, AuditLogEvent, Client } from 'discord.js';
import { sendLog, truncate, moderatorField } from '../../utils/logHelpers';
import { getModerator } from '../../utils/auditLogHelpers';
import { deleteSuggestionByMessageId } from '../../services/suggestionService';
import { getMessageSnapshot, deleteMessageSnapshot, StoredMessage } from '../../services/messageSnapshotService';
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

  // Wiadomości sprzed restartu bota nie ma w cache (partial: brak autora i treści) - bierzemy
  // je z kopii w bazie. Kopię usuwamy zawsze, bo wiadomość już nie istnieje.
  const snapshotRes = await getMessageSnapshot(message.guild.id, message.id);
  const snapshot: StoredMessage | null = snapshotRes.ok ? snapshotRes.data : null;
  await deleteMessageSnapshot(message.guild.id, message.id);

  const authorId = message.author?.id ?? snapshot?.authorId;
  const authorTag = message.author?.tag ?? snapshot?.authorTag;
  const authorIcon = message.author?.displayAvatarURL() ?? snapshot?.authorAvatarUrl ?? undefined;

  const moderator = await getModerator(message.guild, AuditLogEvent.MessageDelete, authorId);

  const knownContent = message.partial ? snapshot?.content : message.content;
  const content =
    knownContent === undefined
      ? '*Treść nieznana - wiadomość sprzed włączenia logów*'
      : knownContent || '*Brak treści (możliwe embedy/attachmenty)*';

  const attachmentUrls = message.attachments?.size
    ? message.attachments.map((a) => a.url)
    : snapshot?.attachmentUrls ?? [];
  const attachments = attachmentUrls.length
    ? `\n**Załączniki (${attachmentUrls.length}):** ${attachmentUrls.join(', ')}`
    : '';

  await sendLog(client, message.guild.id, 'messageDelete', {
    title: null,
    description: `**🗑️ Wiadomość wysłana przez ${authorId ? `<@${authorId}>` : '**Nieznany**'} została usunięta na kanale <#${message.channelId}>.**\n\n${truncate(content, 1000)}${attachments}`,
    fields: moderator ? [moderatorField(moderator.id)] : [],
    authorName: authorTag || 'Nieznany',
    authorIcon,
  }, { channelId: message.channelId, userId: authorId });
}
