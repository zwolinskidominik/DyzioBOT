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

  // Cache wiadomości obejmuje tylko to, co bot widział od swojego startu. Dla starszych
  // wiadomości `oldMessage` przychodzi jako partial (patrz `partials` w src/index.ts) i ma
  // `content === null` — nie wiemy, jak wyglądała treść przed zmianą. Wcześniej wpisywaliśmy
  // w takim przypadku "*Brak treści*", co sugerowało, że wiadomość była pusta. To nieprawda:
  // treści po prostu nie znamy. Discord wysyła messageUpdate także przy samym przegenerowaniu
  // podglądu linku, więc takie wpisy potrafią dotyczyć wiadomości, których nikt nie edytował.
  const oldContent = oldMessage.partial
    ? '(treść nieznana — wiadomość spoza pamięci bota)'
    : oldMessage.content || '*Brak treści*';
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
