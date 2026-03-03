import { getModelForClass, index, prop, DocumentType } from '@typegoose/typegoose';

@index({ guildId: 1, inviterId: 1 })
@index({ guildId: 1, joinedUserId: 1 })
class InviteEntry {
  @prop({ required: true, type: () => String })
  public guildId!: string;

  /** The user ID of the person who created the invite. Null if unknown. */
  @prop({ type: () => String, default: null })
  public inviterId?: string | null;

  /** The user ID who joined using the invite. */
  @prop({ required: true, type: () => String })
  public joinedUserId!: string;

  /** The invite code that was used. */
  @prop({ type: () => String, default: null })
  public inviteCode?: string | null;

  /** Whether the user is still in the guild. */
  @prop({ type: () => Boolean, default: true })
  public active!: boolean;

  /** Whether this invite is considered "fake" (account age < 7 days). */
  @prop({ type: () => Boolean, default: false })
  public fake!: boolean;

  @prop({ type: () => Date, default: () => new Date() })
  public joinedAt!: Date;

  @prop({ type: () => Date, default: null })
  public leftAt?: Date | null;
}

export const InviteEntryModel = getModelForClass(InviteEntry);
export type InviteEntryDocument = DocumentType<InviteEntry>;
