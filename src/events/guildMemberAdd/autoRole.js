const { GuildMember } = require("discord.js");
const AutoRole = require("../../models/AutoRole");

/**
 *
 * @param {GuildMember} member
 */
module.exports = async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    const autoRoleConfig = await AutoRole.findOne({ guildId: guild.id });

    if (autoRoleConfig && autoRoleConfig.roleIds.length > 0) {
      if (member.user.bot) {
        const botRoleId = autoRoleConfig.roleIds[0];
        const botRole = guild.roles.cache.get(botRoleId);

        if (botRole) {
          await member.roles.add(botRole);
          console.log(`Bot role added successfully to ${member.user.tag}`);
        } else {
          console.log(
            `Bot role does not exist or is not configured for ${guild.name}`
          );
        }
      } else {
        const userRoleIds = autoRoleConfig.roleIds.slice(1);

        for (const roleId of userRoleIds) {
          const userRole = guild.roles.cache.get(roleId);
          if (userRole) {
            await member.roles.add(userRole);
          } else {
            console.log(
              `Role with ID ${roleId} does not exist in guild ${guild.name}`
            );
          }
        }
      }
    }
  } catch (error) {
    console.log(`Error giving roles automatically: ${error}`);
  }
};
