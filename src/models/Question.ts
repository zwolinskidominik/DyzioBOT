import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';
import { randomUUID } from 'crypto';

class Question {
  @prop({ default: () => randomUUID(), type: () => String })
  public questionId!: string;

  @prop({ required: true, type: () => String })
  public authorId!: string;

  @prop({ required: true, type: () => String })
  public content!: string;

  @prop({ type: () => [String], default: [] })
  public reactions!: string[];
}

export const QuestionModel = getModelForClass(Question);
export type QuestionDocument = DocumentType<Question>;
