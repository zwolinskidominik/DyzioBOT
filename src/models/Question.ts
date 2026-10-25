import { prop, getModelForClass, DocumentType, index } from '@typegoose/typegoose';
import { randomUUID } from 'crypto';

@index({ content: 1 }, { unique: true })
class Question {
  // Stały identyfikator - historia wysłanych (UsedQuestion) wiąże się po nim. Stare wpisy bez
  // tego pola uzupełnia ensureQuestionIds() przy starcie bota (events/clientReady/questionIds.ts).
  @prop({ required: true, default: () => randomUUID(), type: () => String })
  public questionId!: string;

  @prop({ required: true, type: () => String })
  public authorId!: string;

  @prop({ required: true, type: () => String })
  public content!: string;

  @prop({ type: () => [String], default: [] })
  public reactions!: string[];

  @prop({ type: () => Boolean, default: false })
  public disabled!: boolean;

  @prop({ type: () => Date })
  public usedAt?: Date;
}

export const QuestionModel = getModelForClass(Question);
export type QuestionDocument = DocumentType<Question>;
