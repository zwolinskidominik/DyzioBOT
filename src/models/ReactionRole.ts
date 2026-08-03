import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, messageId: 1 })
class ReactionRole {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  // Opt-out semantics: no dashboard UI writes this field yet, so existing
  // panels (created before this flag was enforced) must stay active.
  @prop({ default: true, type: () => Boolean })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public channelId!: string;

  @prop({ required: true, type: () => String })
  public messageId!: string;

  @prop({ type: () => String })
  public title?: string;

  @prop({ type: () => [ReactionRoleMapping], default: [] })
  public reactions!: ReactionRoleMapping[];
}

class ReactionRoleMapping {
  @prop({ required: true, type: () => String })
  public emoji!: string;

  @prop({ required: true, type: () => String })
  public roleId!: string;

  @prop({ type: () => String })
  public description?: string;
}

export const ReactionRoleModel = getModelForClass(ReactionRole);
export type ReactionRoleDocument = DocumentType<ReactionRole>;
