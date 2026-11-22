import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'guildsettings' } })
@index({ guildId: 1 }, { unique: true })
class GuildSettings {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** Język odpowiedzi bota: 'pl' albo 'en' (dashboard → Ustawienia). Odczyt: src/i18n/guildLanguage.ts. */
  @prop({ default: 'pl', type: () => String })
  public language!: string;

  @prop({ type: () => String })
  public systemNotifyChannelId?: string;
}

export const GuildSettingsModel = getModelForClass(GuildSettings);
export type GuildSettingsDocument = DocumentType<GuildSettings>;
