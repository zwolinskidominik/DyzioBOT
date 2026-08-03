import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { ReactionRoleModel } from '../../models/ReactionRole';
import { ReactionRoleConfigModel } from '../../models/ReactionRoleConfig';
import logger from '../../utils/logger';

export default async function run(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const message = reaction.message;
    if (!message.guild) return;

    const masterConfig = await ReactionRoleConfigModel.findOne({ guildId: message.guild.id });
    if (masterConfig && masterConfig.enabled === false) return;

    const reactionRoleData = await ReactionRoleModel.findOne({
      guildId: message.guild.id,
      messageId: message.id,
    });

    if (!reactionRoleData || reactionRoleData.enabled === false) return;

    const emoji = reaction.emoji.toString().replace(/\uFE0F/g, '');
    const mapping = reactionRoleData.reactions.find((r) => r.emoji.replace(/\uFE0F/g, '') === emoji);

    if (!mapping) return;

    const member = await message.guild.members.fetch(user.id);
    if (!member) return;

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
