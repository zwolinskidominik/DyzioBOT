import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

class Fortune {
  @prop({ required: true, type: () => String })
  public content!: string;

  @prop({ type: () => String })
  public addedBy?: string;
}

export const FortuneModel = getModelForClass(Fortune);
export type FortuneDocument = DocumentType<Fortune>;

@index({ userId: 1, targetId: 1 })
class FortuneUsage {
  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public targetId!: string;

  @prop({ default: Date.now, type: () => Date })
  public lastUsed!: Date;

  @prop({ default: Date.now, type: () => Date })
  public lastUsedDay!: Date;

  @prop({ default: 0, type: () => Number })
  public dailyUsageCount!: number;
}

export const FortuneUsageModel = getModelForClass(FortuneUsage);
export type FortuneUsageDocument = DocumentType<FortuneUsage>;
