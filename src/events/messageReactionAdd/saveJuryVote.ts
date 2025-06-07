import { MessageReaction, User, GuildMember } from 'discord.js';
import { ClipModel, ClipDocument } from '../../models/Clip';
import { JURY_ROLE_ID, REACTION_TO_SCORE } from '../../config/constants/clipSystem';
import logger from '../../utils/logger';

export default async function run(reaction: MessageReaction, user: User): Promise<void> {
  try {
    if (user.bot) return;

    reaction = await fetchFullReaction(reaction);
    await fetchFullMessage(reaction);

    const clip = await getClipByMessageId(reaction.message.id);
    if (!clip) return;

    if (!(await hasJuryRole(reaction, user.id))) return;

    const emojiName = reaction.emoji.name;
    if (!emojiName) return;

    const score = REACTION_TO_SCORE[emojiName];
    if (score === undefined) return;

    await removePreviousVote(reaction.message.id, user.id);

    let juryName = '';
    try {
      const member = await reaction.message.guild!.members.fetch(user.id);
      juryName = member.user.tag;
    } catch (e) {
      juryName = user.id;
    }
    await addNewVote(reaction.message.id, user.id, score, juryName);
  } catch (error: unknown) {
    logger.error(`Błąd podczas przetwarzania reakcji clip-vote: ${error}`);
  }
}

async function fetchFullReaction(reaction: MessageReaction): Promise<MessageReaction> {
  if (reaction.partial) {
    try {
      return await reaction.fetch();
    } catch (error: unknown) {
      logger.error(`Błąd podczas pobierania pełnych danych reakcji: ${error}`);
      throw error;
    }
  }
  return reaction;
}

async function fetchFullMessage(reaction: MessageReaction): Promise<void> {
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error: unknown) {
      logger.error(`Błąd podczas pobierania pełnych danych wiadomości: ${error}`);
      throw error;
    }
  }
}

async function getClipByMessageId(messageId: string): Promise<ClipDocument | null> {
  return await ClipModel.findOne({ messageId }).exec();
}

async function hasJuryRole(reaction: MessageReaction, userId: string): Promise<boolean> {
  try {
    const member: GuildMember = await reaction.message.guild!.members.fetch(userId);
    return member.roles.cache.has(JURY_ROLE_ID);
  } catch (error) {
    logger.error(`Błąd podczas sprawdzania roli użytkownika ${userId}: ${error}`);
    return false;
  }
}

async function removePreviousVote(messageId: string, userId: string): Promise<void> {
  await ClipModel.updateOne({ messageId }, { $pull: { votes: { juryId: userId } } });
}

async function addNewVote(
  messageId: string,
  userId: string,
  score: number,
  juryName: string
): Promise<void> {
  await ClipModel.updateOne(
    { messageId },
    { $push: { votes: { juryId: userId, score, juryName } } }
  );
}
