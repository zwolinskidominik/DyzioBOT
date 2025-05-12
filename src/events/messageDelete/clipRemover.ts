import { Message } from 'discord.js';
import { ClipModel } from '../../models/Clip';
import { CLIPS_CHANNEL_ID } from '../../config/constants/clipSystem';
import logger from '../../utils/logger';

export default async function run(message: Message): Promise<void> {
  try {
    if (message.channelId === CLIPS_CHANNEL_ID) {
      await removeClipFromDatabase(message.id);
    }

    if (message.partial) {
      const fullMessage = await fetchFullMessage(message);

      if (!fullMessage && message.channelId === CLIPS_CHANNEL_ID) {
        await removeClipFromDatabase(message.id);
      }
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;

    logger.error('Błąd podczas usuwania klipu:', {
      errorMessage: errMsg,
      errorCode: errCode,
      messageId: message.id,
      channelId: message.channelId,
    });
  }
}

function isErrorWithCode(err: unknown): err is { code: number } {
  if (typeof err !== 'object' || err === null) return false;
  const possibleCode = (err as Record<string, unknown>)['code'];
  return typeof possibleCode === 'number';
}

async function fetchFullMessage(message: Message): Promise<Message | null> {
  if (!message.partial) return message;

  try {
    return await message.fetch();
  } catch (error: unknown) {
    if (isErrorWithCode(error) && error.code === 10008) {
      return null;
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = isErrorWithCode(error) ? error.code : undefined;
    logger.error(
      `Błąd podczas pobierania pełnych danych wiadomości: code=${errCode}, message=${errMsg}`
    );
    throw error;
  }
}

async function removeClipFromDatabase(messageId: string): Promise<void> {
  const result = await ClipModel.findOneAndDelete({ messageId });

  if (result) {
    logger.info(`Usunięto klip z bazy danych, messageId=${messageId}`);
  } else {
    logger.debug(`Nie znaleziono klipu do usunięcia, messageId=${messageId}`);
  }
}
