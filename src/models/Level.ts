import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1 }, { unique: true })
class Level {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ default: 0, type: () => Number })
  public xp!: number;

  @prop({ default: 1, type: () => Number })
  public level!: number;

  @prop({ type: () => Date })
  public lastMessageTs?: Date;

  @prop({ type: () => Date })
  public lastVcUpdateTs?: Date;
}

export const LevelModel = getModelForClass(Level);
export type LevelDocument = DocumentType<Level>;
