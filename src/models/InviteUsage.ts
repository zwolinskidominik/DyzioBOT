import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Trwała historia liczników zaproszeń. Discord przestaje pokazywać zaproszenie (a z nim jego
 * licznik), gdy ono wygaśnie, zostanie usunięte albo zużyje limit - tutaj wpis zostaje
 * (deleted=true), więc „ma X zaproszeń" nie spada po wygaśnięciu linku.
 */
@modelOptions({ schemaOptions: { timestamps: true, collection: 'inviteusages' } })
@index({ guildId: 1, code: 1 }, { unique: true })
@index({ guildId: 1, inviterId: 1 })
class InviteUsage {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public code!: string;

  /** Autor zaproszenia; null, gdy Discord go nie podał. */
  @prop({ type: () => String, default: null })
  public inviterId?: string | null;

  /** Największy znany licznik użyć (nigdy nie maleje). */
  @prop({ required: true, type: () => Number, default: 0 })
  public uses!: number;

  /** Zaproszenie zniknęło z listy Discorda (wygasło, usunięte, zużyte). */
  @prop({ required: true, type: () => Boolean, default: false })
  public deleted!: boolean;

  @prop({ type: () => Date, default: () => new Date() })
  public lastSeenAt!: Date;
}

export const InviteUsageModel = getModelForClass(InviteUsage);
export type InviteUsageDocument = DocumentType<InviteUsage>;
