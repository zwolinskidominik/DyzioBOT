import { prop, getModelForClass, DocumentType, index } from '@typegoose/typegoose';

@index({ guildId: 1, questionId: 1 }, { unique: true })
class UsedQuestion {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public questionId!: string;

  @prop({ default: () => new Date(), type: () => Date })
  public usedAt!: Date;
}

export const UsedQuestionModel = getModelForClass(UsedQuestion);
export type UsedQuestionDocument = DocumentType<UsedQuestion>;
