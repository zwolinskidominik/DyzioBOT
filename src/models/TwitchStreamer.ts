import { getModelForClass, index, prop, DocumentType, pre } from '@typegoose/typegoose';

@pre<TwitchStreamer>('save', function () {
  if (typeof this.twitchChannel === 'string') {
    this.twitchChannel = this.twitchChannel.toLowerCase();
  }
})
@index({ guildId: 1, userId: 1 }, { unique: true })
@index({ guildId: 1, twitchChannel: 1 }, { unique: true })
class TwitchStreamer {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String, lowercase: true, trim: true })
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
