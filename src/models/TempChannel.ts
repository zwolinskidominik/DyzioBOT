import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 })
class TempChannel {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public parentId!: string;

  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, type: () => String })
  public ownerId!: string;
}

export const TempChannelModel = getModelForClass(TempChannel);
export type TempChannelDocument = DocumentType<TempChannel>;
