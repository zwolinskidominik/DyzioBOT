import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { timestamps: true, collection: 'economies' } })
@index({ guildId: 1, userId: 1 }, { unique: true })
@index({ guildId: 1, netWorth: -1 })
@index({ guildId: 1, wallet: -1 })
@index({ guildId: 1, bank: -1 })
class Economy {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  // Portfele — zawsze INTEGER (całe żetony)
  @prop({ default: 0, type: () => Number, min: 0 })
  public wallet!: number;

  @prop({ default: 0, type: () => Number, min: 0 })
  public bank!: number;

  // Statystyki lifetime
  @prop({ default: 0, type: () => Number })
  public netWorth!: number;

  @prop({ default: 0, type: () => Number })
  public totalEarned!: number;

  @prop({ default: 0, type: () => Number })
  public totalSpent!: number;

  @prop({ default: 0, type: () => Number })
  public totalWon!: number;

  @prop({ default: 0, type: () => Number })
  public totalLost!: number;

  // Streaki
  @prop({ default: 0, type: () => Number })
  public dailyStreak!: number;

  @prop({ default: 0, type: () => Number })
  public weeklyStreak!: number;

  @prop({ default: 0, type: () => Number })
  public monthlyStreak!: number;

  @prop({ type: () => Date })
  public lastDaily?: Date;

  @prop({ type: () => Date })
  public lastWeekly?: Date;

  @prop({ type: () => Date })
  public lastMonthly?: Date;

  // Aktywność
  @prop({ default: 1, type: () => Number, min: 1 })
  public economyLevel!: number;

  @prop({ default: 0, type: () => Number })
  public reputation!: number;

  @prop({ type: () => Date })
  public lastActivityAt?: Date;
}

export const EconomyModel = getModelForClass(Economy);
export type EconomyDocument = DocumentType<Economy>;
