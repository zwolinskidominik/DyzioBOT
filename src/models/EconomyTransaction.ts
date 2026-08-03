import { getModelForClass, index, modelOptions, prop, DocumentType } from '@typegoose/typegoose';

export enum TransactionType {
  // Zarabianie
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  WORK = 'WORK',
  CRIME = 'CRIME',
  ROB = 'ROB',
  COLLECT = 'COLLECT',
  BEG = 'BEG',
  SEARCH = 'SEARCH',
  FISH = 'FISH',
  HUNT = 'HUNT',
  MINE = 'MINE',
  // Kasyno
  COINFLIP = 'COINFLIP',
  BLACKJACK = 'BLACKJACK',
  ROULETTE = 'ROULETTE',
  DICE = 'DICE',
  SLOTS = 'SLOTS',
  CASE_BATTLE = 'CASE_BATTLE',
  // Sklep / Inventory
  SHOP_BUY = 'SHOP_BUY',
  SHOP_SELL = 'SHOP_SELL',
  ITEM_SELL = 'ITEM_SELL',
  LOOTBOX_OPEN = 'LOOTBOX_OPEN',
  // Między użytkownikami
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  SEND = 'SEND',
  PAYMENT = 'PAYMENT',
  // Aktywność
  QUEST_COMPLETE = 'QUEST_COMPLETE',
  ACHIEVEMENT_REWARD = 'ACHIEVEMENT_REWARD',
  LEVEL_UP = 'LEVEL_UP',
  // Administracja
  ADMIN_ADD = 'ADMIN_ADD',
  ADMIN_REMOVE = 'ADMIN_REMOVE',
  RESET = 'RESET',
}

@modelOptions({ schemaOptions: { timestamps: true, collection: 'economy_transactions' } })
@index({ guildId: 1, userId: 1 })
@index({ guildId: 1, createdAt: -1 })
class EconomyTransaction {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, enum: Object.values(TransactionType), type: () => String })
  public type!: string;

  /** Kwota +/- w całych żetonach (INTEGER) */
  @prop({ required: true, type: () => Number })
  public amount!: number;

  @prop({ required: true, type: () => Number })
  public walletAfter!: number;

  @prop({ required: true, type: () => Number })
  public bankAfter!: number;

  /** Dla SEND, PAYMENT, ROB, CASE_BATTLE */
  @prop({ type: () => String })
  public targetUserId?: string;

  /** Dodatkowy kontekst: skinId, jobName, gameResult, etc. */
  @prop({ type: () => Object })
  public meta?: Record<string, unknown>;

  /** Populowane przez timestamps: true w schemaOptions */
  @prop({ type: () => Date })
  public createdAt!: Date;
}

export const EconomyTransactionModel = getModelForClass(EconomyTransaction);
export type EconomyTransactionDocument = DocumentType<EconomyTransaction>;
