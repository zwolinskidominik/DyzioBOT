import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
export class MonthlyStatsConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => String })
  public channelId?: string;

  @prop({ default: true, type: () => Boolean })
  public enabled!: boolean;

  @prop({ default: 10, type: () => Number, min: 1, max: 25 })
  public topCount!: number;
}

export const MonthlyStatsConfigModel = getModelForClass(MonthlyStatsConfig);
export type MonthlyStatsConfigDocument = DocumentType<MonthlyStatsConfig>;
