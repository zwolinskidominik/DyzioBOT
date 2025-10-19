import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class StreamConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({
    required: true,
    type: () => String,
    match: /^\d+$/, // expect a numeric Discord channel snowflake
  })
  public channelId!: string;
}

export const StreamConfigurationModel = getModelForClass(StreamConfiguration);
export type StreamConfigurationDocument = DocumentType<StreamConfiguration>;
