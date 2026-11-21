import { index, prop, getModelForClass, DocumentType, modelOptions } from '@typegoose/typegoose';

/**
 * Elementy Discorda założone przez funkcję Minecraft na serwerze GameZone - zapamiętane, żeby po
 * restarcie bota niczego nie tworzyć drugi raz. Jeden dokument na serwer.
 */
@index({ guildId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: true, collection: 'minecraft_state' } })
class MinecraftState {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** Kategoria „⛏️ Minecraft” założona przez bota przy pierwszym uruchomieniu. */
  @prop({ type: () => String })
  public categoryId?: string | undefined;

  /** Kanał głosowy-licznik. */
  @prop({ type: () => String })
  public statsChannelId?: string | undefined;

  /** Stały panel /minecraft (odświeżany przez bota). */
  @prop({ type: () => String })
  public panelChannelId?: string | undefined;

  @prop({ type: () => String })
  public panelMessageId?: string | undefined;

  /** Kto ostatnio włączył serwer przyciskiem ▶️ (czyszczone, gdy maszyna jest wyłączona). */
  @prop({ type: () => String })
  public startedBy?: string | undefined;

  @prop({ type: () => Date })
  public startedAt?: Date | undefined;
}

export const MinecraftStateModel = getModelForClass(MinecraftState);
export type MinecraftStateDocument = DocumentType<MinecraftState>;
