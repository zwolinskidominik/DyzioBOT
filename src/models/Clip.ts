import {
  prop,
  getModelForClass,
  modelOptions,
  Severity,
  ReturnModelType,
  DocumentType,
} from '@typegoose/typegoose';

class Vote {
  @prop({ type: () => String })
  public juryId?: string;

  @prop({ type: () => Number })
  public score?: number;
}

@modelOptions({
  options: { allowMixed: Severity.ALLOW },
})
class Clip {
  @prop({ required: true, unique: true, type: () => String })
  public messageId!: string;

  @prop({ required: true, type: () => String })
  public authorId!: string;

  @prop({ required: true, type: () => String })
  public messageLink!: string;

  @prop({ default: Date.now, type: () => Date })
  public timestamp!: Date;

  @prop({ type: () => [Vote], default: [] })
  public votes!: Vote[];

  public getAverageScore(): number {
    if (!this.votes || this.votes.length === 0) return 0;
    const sum = this.votes.reduce((acc, vote) => acc + (vote.score || 0), 0);
    return sum / this.votes.length;
  }

  public static async clearAll(this: ReturnModelType<typeof Clip>): Promise<void> {
    await this.deleteMany({});
  }
}

export const ClipModel = getModelForClass(Clip);
export type ClipDocument = DocumentType<Clip>;
