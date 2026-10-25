import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

/** Po tylu sekundach MongoDB sam usuwa kopię wiadomości (indeks TTL na `storedAt`). */
export const MESSAGE_SNAPSHOT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Kopia wiadomości na potrzeby logów usunięcia/edycji. Cache discord.js żyje tylko w pamięci,
 * więc po restarcie bot nie znał treści ani autora starszych wiadomości („Nieznany”).
 * Zapisywane tylko na serwerach z włączonym logiem usunięcia lub edycji; wpis znika po
 * 30 dniach albo od razu po zalogowaniu usunięcia.
 */
@modelOptions({ schemaOptions: { collection: 'messagesnapshots' } })
@index({ guildId: 1, messageId: 1 }, { unique: true })
@index({ storedAt: 1 }, { expireAfterSeconds: MESSAGE_SNAPSHOT_TTL_SECONDS })
class MessageSnapshot {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, type: () => String })
  public messageId!: string;

  @prop({ required: true, type: () => String })
  public authorId!: string;

  @prop({ required: true, type: () => String })
  public authorTag!: string;

  @prop({ type: () => String, default: null })
  public authorAvatarUrl?: string | null;

  @prop({ type: () => String, default: '' })
  public content!: string;

  @prop({ type: () => [String], default: [] })
  public attachmentUrls!: string[];

  @prop({ required: true, type: () => Date, default: () => new Date() })
  public storedAt!: Date;
}

export const MessageSnapshotModel = getModelForClass(MessageSnapshot);
export type MessageSnapshotDocument = DocumentType<MessageSnapshot>;
