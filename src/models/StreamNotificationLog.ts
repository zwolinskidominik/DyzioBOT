import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Lekki log wysłanych powiadomień o streamach — służy WYŁĄCZNIE do liczenia
 * "powiadomień w tym miesiącu" na dashboardzie (bez dodatkowych zapytań do Twitch API).
 * TTL 60 dni — nie potrzebujemy trzymać tego dłużej niż bieżący + poprzedni miesiąc.
 */
@index({ guildId: 1, sentAt: 1 })
@index({ sentAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 })
class StreamNotificationLog {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public twitchChannel!: string;

  @prop({ required: true, type: () => Date })
  public sentAt!: Date;
}

export const StreamNotificationLogModel = getModelForClass(StreamNotificationLog);
export type StreamNotificationLogDocument = DocumentType<StreamNotificationLog>;
