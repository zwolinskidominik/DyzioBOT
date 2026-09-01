import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

/**
 * Kinds pokrywają się dokładnie z KINDS z prototypu dashboardu — `warn-remove`
 * i `unban` NIE są osobnymi wpisami, tylko akcjami cofającymi (undo) istniejący
 * wpis 'warn'/'ban' (ustawiają `undone: true` na oryginalnym wpisie).
 */
export type ModerationLogKind = 'ban' | 'kick' | 'mute' | 'warn' | 'clear';

@modelOptions({
  schemaOptions: {
    collection: 'moderationlogs',
    timestamps: true,
  },
})
@index({ guildId: 1, createdAt: -1 })
@index({ guildId: 1, kind: 1 })
export class ModerationLog {
  @prop({ required: true, type: String })
  public guildId!: string;

  @prop({ required: true, type: String })
  public kind!: ModerationLogKind;

  /** Dla `clear` to nazwa kanału (bez `#`), nie ID użytkownika. */
  @prop({ required: true, type: String })
  public targetId!: string;

  @prop({ required: true, type: String })
  public targetTag!: string;

  @prop({ required: true, type: String })
  public moderatorId!: string;

  @prop({ required: true, type: String })
  public moderatorTag!: string;

  @prop({ type: String, default: '' })
  public reason!: string;

  /** Dodatkowy opis w UI — np. "1 godz." dla mute, "142 wiadomości" dla clear. */
  @prop({ type: String })
  public extra?: string;

  /**
   * Dla kind === 'warn': _id konkretnego wpisu w Warn.warnings, żeby undo
   * (dashboard) wiedziało, który wpis usunąć — pozycja w tablicy się przesuwa
   * (wygasanie, inne usunięcia), więc odwołanie po indeksie byłoby kruche.
   */
  @prop({ type: String })
  public warnEntryId?: string;

  @prop({ type: Boolean, default: false })
  public undone!: boolean;

  @prop({ type: Date, default: () => new Date() })
  public createdAt!: Date;
}

export const ModerationLogModel = getModelForClass(ModerationLog);
