import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1 }, { unique: true })
class AutoRole {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => [String], default: [] })
  public roleIds!: string[];
}

export const AutoRoleModel = getModelForClass(AutoRole);
export type AutoRoleDocument = DocumentType<AutoRole>;
