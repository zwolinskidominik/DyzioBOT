import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class StreamConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;

  @prop({
    required: true,
    type: () => String,
    match: /^\d+$/,
  })
  public channelId!: string;
}

export const StreamConfigurationModel = getModelForClass(StreamConfiguration);
export type StreamConfigurationDocument = DocumentType<StreamConfiguration>;
