import { index, prop, getModelForClass, DocumentType, pre } from '@typegoose/typegoose';

@index({ guildId: 1 })
@pre<Giveaway>('validate', function(next) {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  if (this.endTime && this.endTime.getTime() <= Date.now()) {
    return next(new Error('endTime must be in the future'));
  }
  next();
})
class Giveaway {
  @prop({ required: true, unique: true, type: () => String })
  public giveawayId!: string;

  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, unique: true, type: () => String })
  public messageId!: string;

  @prop({ required: true, type: () => String })
  public prize!: string;

  @prop({ required: true, type: () => String })
  public description!: string;

  @prop({ required: true, type: () => Number })
  public winnersCount!: number;

  @prop({ required: true, type: () => Date })
  public endTime!: Date;

  @prop({ type: () => String })
  public pingRoleId?: string;

  @prop({ default: true, type: () => Boolean })
  public active!: boolean;

  @prop({ type: () => [String], default: [] })
  public participants!: string[];

  @prop({ required: true, type: () => String })
  public hostId!: string;

  @prop({ default: Date.now, type: () => Date })
  public createdAt!: Date;

  @prop({ type: () => Map, default: new Map<string, number>() })
  public roleMultipliers!: Map<string, number>;

  @prop({ default: false, type: () => Boolean })
  public finalized!: boolean;
}

export const GiveawayModel = getModelForClass(Giveaway);
export type GiveawayDocument = DocumentType<Giveaway>;
