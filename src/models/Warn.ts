import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';

export class WarnEntry {
  /** Deklarujemy jawnie, żeby dashboard i /warn-remove mogły odwołać się po stabilnym ID
   * zamiast po pozycji w tablicy (pozycja przesuwa się przy wygasaniu/usuwaniu innych wpisów).
   *
   * `default` jest KONIECZNY: jawna deklaracja `_id` wyłącza automatyczne nadawanie go przez
   * Mongoose, więc bez tego każdy wpis miał `_id: undefined`, a `String(w._id)` dawało
   * dla wszystkich ten sam string "undefined" — czyli dokładne przeciwieństwo stabilnego ID. */
  @prop({ type: () => Types.ObjectId, default: () => new Types.ObjectId() })
  public _id?: Types.ObjectId;

  @prop({ required: true, type: () => String })
  public reason!: string;

  @prop({ default: Date.now, type: () => Date })
  public date!: Date;

  @prop({ required: true, type: () => String })
  public moderatorId!: string;

  @prop({ type: () => String })
  public moderatorTag?: string;
}

@index({ userId: 1, guildId: 1 })
class Warn {
  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => [WarnEntry], default: [] })
  public warnings!: WarnEntry[];
}

export const WarnModel = getModelForClass(Warn);
export type WarnDocument = DocumentType<Warn>;
