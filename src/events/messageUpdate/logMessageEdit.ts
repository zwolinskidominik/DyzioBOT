import { Message, PartialMessage, Client } from 'discord.js';
import { sendLog, truncate } from '../../utils/logHelpers';

export default async function run(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  client: Client
): Promise<void> {
  if (!newMessage.guild) return;
  
  if (newMessage.author?.bot) return;

  if (oldMessage.content === newMessage.content) return;

  const oldContent = oldMessage.content || '*Brak treści*';
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
