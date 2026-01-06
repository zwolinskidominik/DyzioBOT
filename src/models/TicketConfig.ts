import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class TicketConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public categoryId!: string;

  @prop({ type: () => String })
  public panelChannelId?: string;

  @prop({ type: () => String })
  public panelMessageId?: string;
}

export const TicketConfigModel = getModelForClass(TicketConfig);
export type TicketConfigDocument = DocumentType<TicketConfig>;
