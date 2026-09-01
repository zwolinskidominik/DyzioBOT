import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

/** Domyślna treść powiadomienia — zmienne podstawiane przez renderStreamMessageTemplate(). */
export const DEFAULT_STREAM_MESSAGE_TEMPLATE = '@everyone {streamer} właśnie zaczął streama! {link}';

@index({ guildId: 1 }, { unique: true })
class StreamConfiguration {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({
    required: true,
    type: () => String,
    match: /^\d+$/,
  })
  public channelId!: string;

  @prop({ type: () => String, default: DEFAULT_STREAM_MESSAGE_TEMPLATE })
  public messageTemplate!: string;
}

export const StreamConfigurationModel = getModelForClass(StreamConfiguration);
export type StreamConfigurationDocument = DocumentType<StreamConfiguration>;
