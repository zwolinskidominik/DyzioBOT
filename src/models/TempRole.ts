import { index, prop, getModelForClass, DocumentType, modelOptions } from '@typegoose/typegoose';

@index({ guildId: 1, userId: 1 })
@index({ expiresAt: 1 })
@modelOptions({ schemaOptions: { timestamps: true, collection: 'temproles' } })
class TempRole {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, type: () => String })
  public userId!: string;

  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ required: true, type: () => Date })
  public expiresAt!: Date;

  @prop({ required: true, type: () => String })
  public assignedBy!: string;

  @prop({ type: () => String })
  public reason?: string;
}

export const TempRoleModel = getModelForClass(TempRole);
export type TempRoleDocument = DocumentType<TempRole>;
