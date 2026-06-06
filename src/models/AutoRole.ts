import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class AutoRole {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => [String], default: [] })
  public userRoleIds!: string[];

  @prop({ type: () => [String], default: [] })
  public botRoleIds!: string[];

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;
}

export const AutoRoleModel = getModelForClass(AutoRole);
export type AutoRoleDocument = DocumentType<AutoRole>;
