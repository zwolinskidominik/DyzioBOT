const AutoRole = require("../../models/AutoRole");
const logger = require("../../utils/logger");

module.exports = async (member) => {
  try {
    const { guild, user } = member;
    if (!guild) return;

    const autoRoleConfig = await AutoRole.findOne({ guildId: guild.id });
    if (!autoRoleConfig || autoRoleConfig.roleIds.length === 0) return;

    const rolesToAssign = user.bot
      ? [autoRoleConfig.roleIds[0]]
      : autoRoleConfig.roleIds.slice(1);

    for (const roleId of rolesToAssign) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
      } else {
        logger.warn(
          `AutoRole: Rola o ID=${roleId} nie istnieje w guild=${guild.name}`
        );
      }
    }
  } catch (error) {
    logger.error(`Error giving roles automatically: ${error}`);
  }
};
