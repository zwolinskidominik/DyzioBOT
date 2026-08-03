import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

/**
 * Guild-wide master switch for reaction roles, mirroring the "Aktywne" toggle
 * pattern used by Auto Role / Powitania / Tickety. Defaults to true so guilds
 * with panels created before this flag existed keep working unchanged.
 */
@index({ guildId: 1 }, { unique: true })
class ReactionRoleConfig {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: true })
  public enabled!: boolean;
}

export const ReactionRoleConfigModel = getModelForClass(ReactionRoleConfig);
export type ReactionRoleConfigDocument = DocumentType<ReactionRoleConfig>;
