import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class InviteTrackerConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ type: () => String, default: null })
  public logChannelId?: string | null;

  @prop({ type: () => String, default: '' })
  public joinMessage!: string;

  @prop({ type: () => String, default: '' })
  public leaveMessage!: string;
}

export const InviteTrackerConfigModel = getModelForClass(InviteTrackerConfig);
export type InviteTrackerConfigDocument = DocumentType<InviteTrackerConfig>;
