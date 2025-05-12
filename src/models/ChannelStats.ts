import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

class ChannelInfo {
  @prop({ type: () => String })
  public channelId?: string;

  @prop({ type: () => String })
  public template?: string;

  @prop({ type: () => String })
  public member?: string;
}

class ChannelsConfig {
  @prop({ type: () => ChannelInfo })
  public lastJoined?: ChannelInfo;

  @prop({ type: () => ChannelInfo })
  public users?: ChannelInfo;

  @prop({ type: () => ChannelInfo })
  public bots?: ChannelInfo;

  @prop({ type: () => ChannelInfo })
  public bans?: ChannelInfo;
}

@index({ guildId: 1 })
class ChannelStats {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({
    required: true,
    _id: false,
    type: () => ChannelsConfig,
  })
  public channels!: ChannelsConfig;
}

export const ChannelStatsModel = getModelForClass(ChannelStats);
export type ChannelStatsDocument = DocumentType<ChannelStats>;
