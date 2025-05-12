import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

@index({ userId: 1, guildId: 1 }, { unique: true })
class Birthday {
  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => Date })
  public date!: Date;

  @prop({ required: true, default: true, type: () => Boolean })
  public yearSpecified!: boolean;

  @prop({ default: true, type: () => Boolean })
  public active!: boolean;
}

export const BirthdayModel = getModelForClass(Birthday);
export type BirthdayDocument = DocumentType<Birthday>;
