import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';
import { randomUUID } from 'crypto';

@index({ guildId: 1 })
class Suggestion {
  @prop({ default: () => randomUUID(), type: () => String })
  public suggestionId!: string;

  @prop({ required: true, type: () => String })
  public authorId!: string;

  @prop({ required: true, type: () => String })
  public guildId!: string;

  @prop({ required: true, unique: true, type: () => String })
  public messageId!: string;

  @prop({ required: true, type: () => String })
  public content!: string;

  @prop({ type: () => [String], default: [] })
  public upvotes!: string[];

  @prop({ type: () => [String], default: [] })
  public upvoteUsernames!: string[];

  @prop({ type: () => [String], default: [] })
  public downvotes!: string[];

  @prop({ type: () => [String], default: [] })
  public downvoteUsernames!: string[];
}

export const SuggestionModel = getModelForClass(Suggestion);
export type SuggestionDocument = DocumentType<Suggestion>;
