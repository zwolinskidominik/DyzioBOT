import { SuggestionModel, SuggestionDocument } from '../models/Suggestion';
import { SuggestionConfigurationModel } from '../models/SuggestionConfiguration';
import { ServiceResult, ok, fail } from '../types/serviceResult';

/* ── Result types ────────────────────────────────────────────────── */

export interface CreateSuggestionData {
  suggestionId: string;
  messageId: string;
}

export interface VoteData {
  upvotes: string[];
  downvotes: string[];
}

/* ── Service functions ───────────────────────────────────────────── */

/**
 * Check whether the given channel is the configured suggestion channel for the guild.
 */
export async function isSuggestionChannel(params: {
  guildId: string;
  channelId: string;
}): Promise<boolean> {
  const config = await SuggestionConfigurationModel.findOne({
    guildId: params.guildId,
  });
  return !!config && config.suggestionChannelId === params.channelId;
}

/**
 * Persist a new suggestion record in the DB.
 */
export async function createSuggestion(params: {
  authorId: string;
  guildId: string;
  messageId: string;
  content: string;
}): Promise<ServiceResult<CreateSuggestionData>> {
  const { authorId, guildId, messageId, content } = params;

  if (!content.trim()) {
    return fail('EMPTY_CONTENT', 'Treść sugestii nie może być pusta.');
  }

  const doc = await SuggestionModel.create({
    authorId,
    guildId,
    messageId,
    content,
  });

  return ok({
    suggestionId: doc.suggestionId,
    messageId: doc.messageId,
  });
}

/**
 * Get a suggestion by its ID. Returns the messageId for embed updates.
 */
export async function getSuggestion(
  suggestionId: string,
): Promise<ServiceResult<{ suggestionId: string; messageId: string }>> {
  const doc = await SuggestionModel.findOne({ suggestionId }).lean();
  if (!doc) return fail('NOT_FOUND', 'Sugestia nie została znaleziona.');
  return ok({ suggestionId: doc.suggestionId, messageId: doc.messageId });
}

/**
 * Delete a suggestion by its Discord message ID (used when the message is deleted).
 * Returns ok(true) if deleted, ok(false) if not found.
 */
export async function deleteSuggestionByMessageId(
  messageId: string,
): Promise<ServiceResult<boolean>> {
  const result = await SuggestionModel.deleteOne({ messageId });
  return ok(result.deletedCount > 0);
}

/**
 * Cast a vote on a suggestion. A user can only vote once.
 */
export async function vote(params: {
  suggestionId: string;
  odId: string;
  username: string;
  direction: 'upvote' | 'downvote';
}): Promise<ServiceResult<VoteData>> {
  const { suggestionId, odId, username, direction } = params;

  const suggestion = (await SuggestionModel.findOne({
    suggestionId,
  })) as SuggestionDocument | null;

  if (!suggestion) {
    return fail('NOT_FOUND', 'Sugestia nie została znaleziona.');
  }

  const alreadyVoted =
    suggestion.upvotes.includes(odId) || suggestion.downvotes.includes(odId);

  if (alreadyVoted) {
    return fail('ALREADY_VOTED', 'Oddano już głos na tę sugestię.');
  }

  if (direction === 'upvote') {
    suggestion.upvotes.push(odId);
    suggestion.upvoteUsernames.push(username);
  } else {
    suggestion.downvotes.push(odId);
    suggestion.downvoteUsernames.push(username);
  }

  await suggestion.save();

  return ok({
    upvotes: [...suggestion.upvotes],
    downvotes: [...suggestion.downvotes],
  });
}
