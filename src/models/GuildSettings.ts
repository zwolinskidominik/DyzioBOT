import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'guildsettings' } })
@index({ guildId: 1 }, { unique: true })
class GuildSettings {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** Na razie tylko 'pl' jest realnie obsługiwane — 'en' zarezerwowane na przyszłość. */
  @prop({ default: 'pl', type: () => String })
  public language!: string;

  @prop({ type: () => String })
  public systemNotifyChannelId?: string;
}

export const GuildSettingsModel = getModelForClass(GuildSettings);
export type GuildSettingsDocument = DocumentType<GuildSettings>;
