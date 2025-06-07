import { Message } from 'discord.js';
import { ClipModel } from '../../models/Clip';
import { CLIPS_CHANNEL_ID, VALID_REACTIONS } from '../../config/constants/clipSystem';
import logger from '../../utils/logger';

export default async function run(_oldMessage: Message | null, newMessage: Message): Promise<void> {
  try {
    if (!isClipMessage(newMessage)) return;

    const existing = await ClipModel.findOne({ messageId: newMessage.id });
    if (existing) return;

    await saveNewClip(newMessage);
    await addReactionsToClip(newMessage);
  } catch (error) {
    logger.error(`Błąd podczas przetwarzania edytowanej wiadomości (clip): ${error}`);
  }
}

function isClipMessage(message: Message): boolean {
  return message.channelId === CLIPS_CHANNEL_ID && message.content.toLowerCase().includes('#mix');
}

async function saveNewClip(message: Message): Promise<void> {
  const clip = new ClipModel({
    messageId: message.id,
    authorId: message.author.id,
    messageLink: message.url,
  });
  await clip.save();
  logger.info(
    `Zapisano nowy klip (edycja), authorId=${message.author.id}, messageId=${message.id}`
  );
}

async function addReactionsToClip(message: Message): Promise<void> {
  try {
    for (const reaction of VALID_REACTIONS) {
      await message.react(reaction);
    }
    logger.debug(`Dodano reakcje do klipu (edycja) messageId=${message.id}`);
  } catch (error) {
    logger.error(
      `Błąd podczas dodawania reakcji do klipu (edycja) messageId=${message.id}: ${error}`
    );
  }
}
