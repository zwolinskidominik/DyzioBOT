import { index, prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1 }, { unique: true })
class TicketStats {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ default: 0, type: () => Number })
  public count!: number;
}

export const TicketStatsModel = getModelForClass(TicketStats);
export type TicketStatsDocument = DocumentType<TicketStats>;
