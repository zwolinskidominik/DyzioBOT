import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

class HangmanCategory {
  @prop({ required: true, unique: true, type: () => String })
  public name!: string;

  @prop({ required: true, type: () => String })
  public emoji!: string;

  @prop({ type: () => [String], default: [] })
  public words!: string[];
}

export const HangmanCategoryModel = getModelForClass(HangmanCategory);
export type HangmanCategoryDocument = DocumentType<HangmanCategory>;
