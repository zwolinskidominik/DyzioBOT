import { prop, getModelForClass, DocumentType, index, modelOptions } from '@typegoose/typegoose';

class WordleGame {
  @prop({ required: true, type: () => Date })
  public date!: Date;

  @prop({ required: true, type: () => Boolean })
  public won!: boolean;

  @prop({ required: true, type: () => Number })
  public attempts!: number;
}

@index({ userId: 1, guildId: 1 })
@index({ guildId: 1, wins: -1 })
@modelOptions({ schemaOptions: { collection: 'wordlestats' } })
class WordleStat {
  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => Number, default: 0 })
  public wins!: number;

  @prop({ required: true, type: () => Number, default: 0 })
  public losses!: number;

  @prop({ required: true, type: () => Number, default: 0 })
  public totalGuesses!: number; // sum of attempts across won games

  @prop({ required: true, type: () => Number, default: 0 })
  public streak!: number;

  @prop({ required: true, type: () => Number, default: 0 })
  public bestStreak!: number;

  @prop({ type: () => [WordleGame], default: [] })
  public games!: WordleGame[];
}

export const WordleStatModel = getModelForClass(WordleStat);
export type WordleStatDocument = DocumentType<WordleStat>;
