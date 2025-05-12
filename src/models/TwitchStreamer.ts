import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1 }, { unique: true })
class TwitchStreamer {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public twitchChannel!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ default: false, type: () => Boolean })
  public isLive!: boolean;

  @prop({ default: true, type: () => Boolean })
  public active!: boolean;
}

export const TwitchStreamerModel = getModelForClass(TwitchStreamer);
export type TwitchStreamerDocument = DocumentType<TwitchStreamer>;
