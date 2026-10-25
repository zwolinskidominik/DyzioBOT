import { Message } from 'discord.js';
import { storeMessageSnapshot } from '../../services/messageSnapshotService';

/**
 * Zapisuje kopię wiadomości, żeby log usunięcia/edycji znał treść i autora także po
 * restarcie bota. Wiadomości zablokowane przez Anti-Spam tu nie trafiają (antiSpam kończy
 * łańcuch handlerów, zwracając true).
 */
export default async function run(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;
  await storeMessageSnapshot(message);
}
