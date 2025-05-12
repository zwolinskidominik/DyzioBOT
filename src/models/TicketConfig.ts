import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class TicketConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public categoryId!: string;
}

export const TicketConfigModel = getModelForClass(TicketConfig);
export type TicketConfigDocument = DocumentType<TicketConfig>;
