import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class SuggestionConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public suggestionChannelId!: string;
}

export const SuggestionConfigurationModel = getModelForClass(SuggestionConfiguration);
export type SuggestionConfigurationDocument = DocumentType<SuggestionConfiguration>;
