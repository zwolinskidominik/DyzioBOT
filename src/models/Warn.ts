import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

class WarnEntry {
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
