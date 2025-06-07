import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1, bucketStart: 1 }, { unique: true })
@index({ bucketStart: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 32 })
class ActivityBucket {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => Date })
  public bucketStart!: Date;

  @prop({ default: 0, type: () => Number })
  public msgCount!: number;

  @prop({ default: 0, type: () => Number })
  public vcMin!: number;
}

export const ActivityBucketModel = getModelForClass(ActivityBucket);
export type ActivityBucketDocument = DocumentType<ActivityBucket>;
