import { prop, getModelForClass, DocumentType, index } from '@typegoose/typegoose';

@index({ word: 1 }, { unique: true })
@index({ length: 1 })
class WordleWord {
  @prop({ required: true, type: () => String })
  public word!: string;

  @prop({ required: true, type: () => Number, min: 4, max: 11 })
  public length!: number;
}

export const WordleWordModel = getModelForClass(WordleWord);
export type WordleWordDocument = DocumentType<WordleWord>;
