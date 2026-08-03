import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Per-user hangman statistics, scoped to a single guild.
 * Automatically upserted each time a game finishes.
 */
@index({ guildId: 1, userId: 1 }, { unique: true })
@index({ guildId: 1, wins: -1 })
class HangmanStats {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  /** Total games played (finished, not timeouts). */
  @prop({ type: () => Number, default: 0 })
  public gamesPlayed!: number;

  /** Games won. */
  @prop({ type: () => Number, default: 0 })
  public wins!: number;

  /** Games lost. */
  @prop({ type: () => Number, default: 0 })
  public losses!: number;

  /** Current win streak (reset on loss). */
  @prop({ type: () => Number, default: 0 })
  public currentStreak!: number;

  /** Best win streak ever achieved. */
  @prop({ type: () => Number, default: 0 })
  public bestStreak!: number;

  /** Total wrong guesses across all games. */
  @prop({ type: () => Number, default: 0 })
  public totalWrongGuesses!: number;

  /** Total letters guessed across all games. */
  @prop({ type: () => Number, default: 0 })
  public totalLettersGuessed!: number;
}

export const HangmanStatsModel = getModelForClass(HangmanStats);
export type HangmanStatsDocument = DocumentType<HangmanStats>;
