import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1, month: 1 }, { unique: true })
export class MonthlyStats {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public month!: string;

  @prop({ default: 0, type: () => Number })
  public messageCount!: number;

  @prop({ default: 0, type: () => Number })
  public voiceMinutes!: number;

  @prop({ default: () => new Date(), type: () => Date })
  public updatedAt!: Date;
}

export const MonthlyStatsModel = getModelForClass(MonthlyStats);
export type MonthlyStatsDocument = DocumentType<MonthlyStats>;
