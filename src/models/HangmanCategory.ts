import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

class HangmanCategory {
  @prop({ required: true, unique: true, type: () => String })
  public name!: string;

  @prop({ required: true, type: () => String })
  public emoji!: string;

  @prop({ type: () => [String], default: [] })
  public words!: string[];

  /** Kolejność wyświetlania w panelu (nie wpływa na grę — /wisielec losuje kategorię niezależnie od kolejności). */
  @prop({ type: () => Number, default: 0 })
  public order!: number;
}

export const HangmanCategoryModel = getModelForClass(HangmanCategory);
export type HangmanCategoryDocument = DocumentType<HangmanCategory>;
