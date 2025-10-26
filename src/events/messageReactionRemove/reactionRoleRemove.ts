import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { ReactionRoleModel } from '../../models/ReactionRole';
import logger from '../../utils/logger';

export default async function run(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  try {
    // Ignoruj boty
    if (user.bot) return;

    // Fetch partial data
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const message = reaction.message;
    if (!message.guild) return;

    // Sprawdź czy to wiadomość z systemem reakcji → role
    const reactionRoleData = await ReactionRoleModel.findOne({
      guildId: message.guild.id,
      messageId: message.id,
    });

    if (!reactionRoleData) return;

    // Znajdź mapowanie emoji → role
    const emoji = reaction.emoji.toString();
    const mapping = reactionRoleData.reactions.find((r) => r.emoji === emoji);

    if (!mapping) return;

    // Pobierz członka serwera
    const member = await message.guild.members.fetch(user.id);
    if (!member) return;

    // Usuń rolę
    const role = message.guild.roles.cache.get(mapping.roleId);
    if (!role) {
      return;
    }

    if (!member.roles.cache.has(role.id)) {
      return;
    }

    await member.roles.remove(role);
  } catch (error) {
    logger.error(`Błąd w reactionRoleRemove.ts: ${error}`);
  }
}
