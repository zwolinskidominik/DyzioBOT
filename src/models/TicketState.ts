import { prop, index, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ channelId: 1 }, { unique: true })
class TicketState {
  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ default: null, type: () => String })
  public assignedTo?: string;
}

export const TicketStateModel = getModelForClass(TicketState);
export type TicketStateDocument = DocumentType<TicketState>;
