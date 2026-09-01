import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';

export class WarnEntry {
  /** Mongoose nadaje to automatycznie każdemu elementowi tablicy — deklarujemy jawnie,
   * żeby dashboard i /warn-remove z dashboardu mogły odwołać się po stabilnym ID zamiast
   * po pozycji w tablicy (pozycja przesuwa się przy wygasaniu/usuwaniu innych wpisów). */
  @prop({ type: () => Types.ObjectId })
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
