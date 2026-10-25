import { Message, PartialMessage, Client } from 'discord.js';
import { sendLog, truncate } from '../../utils/logHelpers';
import { getMessageSnapshot, storeMessageSnapshot, StoredMessage } from '../../services/messageSnapshotService';

export default async function run(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  client: Client
): Promise<void> {
  if (!newMessage.guild) return;

  if (newMessage.author?.bot) return;

  // Cache discord.js obejmuje tylko to, co bot widział od swojego startu — starsze wiadomości
  // przychodzą jako partial (`content === null`). Wtedy sięgamy po kopię z bazy (patrz
  // messageSnapshotService), a dopiero bez niej piszemy, że treści nie znamy.
  let snapshot: StoredMessage | null = null;
  if (oldMessage.partial) {
    const res = await getMessageSnapshot(newMessage.guild.id, newMessage.id);
    snapshot = res.ok ? res.data : null;
  }

  const previous = oldMessage.partial ? snapshot?.content ?? null : oldMessage.content;
  // Discord wysyła messageUpdate także przy samym przegenerowaniu podglądu linku.
  if (previous !== null && previous === newMessage.content) return;

  // Kopia ma mieć najnowszą treść, żeby kolejna edycja/usunięcie pokazały aktualny stan.
  await storeMessageSnapshot(newMessage);

  const oldContent =
    previous === null ? '(treść nieznana — wiadomość sprzed włączenia logów)' : previous || '*Brak treści*';
  const newContent = newMessage.content || '*Brak treści*';

  await sendLog(client, newMessage.guild.id, 'messageEdit', {
    title: null,
    description: `**✏️ Wiadomość wysłana przez ${newMessage.author ? `<@${newMessage.author.id}>` : '**Nieznany**'} została edytowana na kanale <#${newMessage.channelId}>.** [Przejdź do wiadomości](${newMessage.url})`,
    fields: [
      { name: 'Stare', value: `\`\`\`${truncate(oldContent, 1018)}\`\`\``, inline: false },
      { name: 'Nowe', value: `\`\`\`${truncate(newContent, 1018)}\`\`\``, inline: false },
    ],
    authorName: newMessage.author?.tag || 'Nieznany',
    authorIcon: newMessage.author?.displayAvatarURL(),
  }, { channelId: newMessage.channelId, userId: newMessage.author?.id });
}
