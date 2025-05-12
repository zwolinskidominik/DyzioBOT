import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class TempChannelConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public channelId!: string;
}

export const TempChannelConfigurationModel = getModelForClass(TempChannelConfiguration);
export type TempChannelConfigurationDocument = DocumentType<TempChannelConfiguration>;
