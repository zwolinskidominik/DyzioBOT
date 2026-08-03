import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { timestamps: true, collection: 'economy_configs' } })
@index({ guildId: 1 }, { unique: true })
class EconomyConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ default: 'GameCoins', type: () => String })
  public currencyName!: string;

  @prop({ default: '🪙', type: () => String })
  public currencySymbol!: string;

  @prop({ default: 'GameCoinów', type: () => String })
  public currencyPlural!: string;

  /** Saldo startowe dla nowych użytkowników (INTEGER) */
  @prop({ default: 0, type: () => Number })
  public startingBalance!: number;

  @prop({ default: true, type: () => Boolean })
  public enabled!: boolean;

  /** Maksymalna kwota jednorazowego przelewu (INTEGER) */
  @prop({ default: 100_000, type: () => Number })
  public maxTransfer!: number;
}

export const EconomyConfigModel = getModelForClass(EconomyConfig);
export type EconomyConfigDocument = DocumentType<EconomyConfig>;
