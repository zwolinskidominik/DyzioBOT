import { prop, index, getModelForClass, DocumentType } from '@typegoose/typegoose';

@index({ channelId: 1 }, { unique: true })
@index({ guildId: 1 })
@index({ guildId: 1, creatorId: 1 })
class TicketState {
  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ type: () => String })
  public guildId?: string;

  @prop({ default: null, type: () => String })
  public assignedTo?: string;

  @prop({ type: () => String })
  public typeId?: string;

  @prop({ type: () => String })
  public creatorId?: string;

  @prop({ type: () => Date, default: () => new Date() })
  public lastActivityAt?: Date;
}

export const TicketStateModel = getModelForClass(TicketState);
export type TicketStateDocument = DocumentType<TicketState>;
