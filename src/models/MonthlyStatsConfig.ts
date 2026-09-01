import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
export class MonthlyStatsConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => String })
  public channelId?: string;

  @prop({ default: false, type: () => Boolean })
  public enabled!: boolean;

  @prop({ default: 10, type: () => Number, min: 1, max: 15 })
  public topCount!: number;

  /** Ile wiadomości = 1 punkt (im mniej, tym mocniej liczy się aktywność na czacie). */
  @prop({ default: 1, type: () => Number, min: 1, max: 5 })
  public msgRate!: number;

  /** Ile minut na voice = 1 punkt (im mniej, tym mocniej liczy się czas na kanałach głosowych). */
  @prop({ default: 2, type: () => Number, min: 1, max: 5 })
  public voiceRate!: number;
}

export const MonthlyStatsConfigModel = getModelForClass(MonthlyStatsConfig);
export type MonthlyStatsConfigDocument = DocumentType<MonthlyStatsConfig>;
