import { getModelForClass, prop, index, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class BirthdayConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public birthdayChannelId!: string;
}

export const BirthdayConfigurationModel = getModelForClass(BirthdayConfiguration);
export type BirthdayConfigurationDocument = DocumentType<BirthdayConfiguration>;
