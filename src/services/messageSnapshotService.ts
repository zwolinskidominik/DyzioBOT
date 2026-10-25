import { Message, PartialMessage } from 'discord.js';
import { LogConfigurationModel } from '../models/LogConfiguration';
import { MessageSnapshotModel } from '../models/MessageSnapshot';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/**
 * Kopie wiadomości dla logów usunięcia/edycji (kolekcja messagesnapshots, TTL 30 dni).
 * Zapisujemy tylko tam, gdzie te logi są włączone — reszta serwerów nie płaci za to ani
 * miejscem w bazie, ani prywatnością użytkowników.
 */

export interface StoredMessage {
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string | null;
  content: string;
  attachmentUrls: string[];
}

interface LeanLogConfig {
  enabled?: boolean;
  enabledEvents?: Record<string, boolean>;
  ignoredChannels?: string[];
}

interface CachedDecision {
  enabled: boolean;
  ignoredChannels: string[];
  expiresAt: number;
}

/** Konfiguracja logów czytana przy KAŻDEJ wiadomości — krótki cache odciąża bazę. */
const CONFIG_CACHE_TTL_MS = 60 * 1000;
const configCache = new Map<string, CachedDecision>();

/** Tylko do testów. */
export function clearSnapshotConfigCache(): void {
  configCache.clear();
}

async function shouldStore(guildId: string, channelId: string): Promise<boolean> {
  const now = Date.now();
  let decision = configCache.get(guildId);
  if (!decision || decision.expiresAt <= now) {
    const config = await LogConfigurationModel.findOne({ guildId }).lean<LeanLogConfig>();
    const events = config?.enabledEvents ?? {};
    decision = {
      enabled: Boolean(config?.enabled && (events.messageDelete || events.messageEdit)),
      ignoredChannels: config?.ignoredChannels ?? [],
      expiresAt: now + CONFIG_CACHE_TTL_MS,
    };
    configCache.set(guildId, decision);
  }
  return decision.enabled && !decision.ignoredChannels.includes(channelId);
}

function hasLoggableAuthor(message: Message | PartialMessage): boolean {
  return Boolean(message.guildId && message.author && !message.author.bot);
}

/** Zapisuje (lub nadpisuje po edycji) kopię wiadomości. Nic nie robi, gdy logi są wyłączone. */
export async function storeMessageSnapshot(message: Message | PartialMessage): Promise<ServiceResult<boolean>> {
  if (!hasLoggableAuthor(message) || message.content === null) return ok(false);
  const guildId = message.guildId!;
  const author = message.author!;

  try {
    if (!(await shouldStore(guildId, message.channelId))) return ok(false);

    await MessageSnapshotModel.updateOne(
      { guildId, messageId: message.id },
      {
        $set: {
          channelId: message.channelId,
          authorId: author.id,
          authorTag: author.tag,
          authorAvatarUrl: author.displayAvatarURL(),
          content: message.content,
          attachmentUrls: message.attachments ? [...message.attachments.values()].map((a) => a.url) : [],
        },
        // Termin wygaśnięcia liczony od wysłania, edycja go nie przedłuża.
        $setOnInsert: { storedAt: new Date() },
      },
      { upsert: true }
    );
    return ok(true);
  } catch (err) {
    logger.error('storeMessageSnapshot failed', { guildId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się zapisać kopii wiadomości.');
  }
}

/** Kopia wiadomości, jeśli ją mamy (null = brak kopii). */
export async function getMessageSnapshot(
  guildId: string,
  messageId: string
): Promise<ServiceResult<StoredMessage | null>> {
  try {
    const doc = await MessageSnapshotModel.findOne({ guildId, messageId }).lean();
    if (!doc) return ok(null);
    return ok({
      authorId: doc.authorId,
      authorTag: doc.authorTag,
      authorAvatarUrl: doc.authorAvatarUrl ?? null,
      content: doc.content ?? '',
      attachmentUrls: doc.attachmentUrls ?? [],
    });
  } catch (err) {
    logger.error('getMessageSnapshot failed', { guildId, messageId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się odczytać kopii wiadomości.');
  }
}

/** Po zalogowaniu usunięcia kopia nie jest już potrzebna. */
export async function deleteMessageSnapshot(guildId: string, messageId: string): Promise<ServiceResult<boolean>> {
  try {
    const res = await MessageSnapshotModel.deleteOne({ guildId, messageId });
    return ok(res.deletedCount > 0);
  } catch (err) {
    logger.error('deleteMessageSnapshot failed', { guildId, messageId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się usunąć kopii wiadomości.');
  }
}
