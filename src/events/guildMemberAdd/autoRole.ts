import { GuildMember } from 'discord.js';
import { AutoRoleModel } from '../../models/AutoRole';
import logger from '../../utils/logger';

export default async function run(member: GuildMember): Promise<void> {
  try {
    const { guild, user } = member;
    if (!guild) {
      logger.debug('Brak obiektu guild dla członka');
      return;
    }

    const autoRoleConfig = await AutoRoleModel.findOne({ guildId: guild.id });
    if (!autoRoleConfig || !autoRoleConfig.roleIds.length) {
      return;
    }

    const roleIdsToAssign = user.bot
      ? [autoRoleConfig.roleIds[0]]
      : autoRoleConfig.roleIds.slice(1);

    if (!roleIdsToAssign.length) {
      return;
    }

    const validRoles = roleIdsToAssign
      .map((id) => guild.roles.cache.get(id))
      .filter((role) => !!role);

    if (!validRoles.length) {
      logger.warn(
        `AutoRole: Brak prawidłowo znalezionych ról dla serwera: ${guild.name} (${guild.id})`
      );
      return;
    }

    await member.roles.add(validRoles);
  } catch (error) {
    logger.error(`Błąd w przypisywaniu automatycznych ról dla ${member.user.tag}: ${error}`);
  }
}
