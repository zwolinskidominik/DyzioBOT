import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Yearly snapshot of a user's level & XP, taken automatically on November 11
 * (server birthday) so the Wrapped can show "you gained X levels this year".
 */
@index({ guildId: 1, userId: 1, year: 1 }, { unique: true })
class LevelSnapshot {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  /** The year this snapshot was taken for (e.g. 2025 = snapshot before 2025-2026 year). */
  @prop({ required: true, type: () => Number })
  public year!: number;

  @prop({ required: true, type: () => Number })
  public level!: number;

  @prop({ required: true, type: () => Number })
  public xp!: number;

  @prop({ type: () => Date, default: () => new Date() })
  public createdAt!: Date;
}

export const LevelSnapshotModel = getModelForClass(LevelSnapshot);
export type LevelSnapshotDocument = DocumentType<LevelSnapshot>;
