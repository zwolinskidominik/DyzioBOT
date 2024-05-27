const { Client, GuildMember } = require('discord.js');
const AutoRole = require('../../models/AutoRole');

/**
 *
 * @param {Client} client
 * @param {GuildMember} member
 */
module.exports = async (client, member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    // Check if roles are configured
    const autoRoleConfig = await AutoRole.findOne({ guildId: guild.id });

    if (autoRoleConfig && autoRoleConfig.roleIds.length > 0) {
      // Check if the user who joined is a bot
      if (member.user.bot) {
        // Get the 'Bot' role with specified ID
        const botRoleId = autoRoleConfig.roleIds[0];
        const botRole = guild.roles.cache.get(botRoleId);

        // Check if the bot role exists
        if (botRole) {
          // Add the bot role to the bot
          await member.roles.add(botRole);
          console.log(`Bot role added successfully to ${member.user.tag}`);
        } else {
          console.log(`Bot role does not exist or is not configured for ${guild.name}`);
        }
      } else {
        // Get the 'User' roles with specified IDs
        const userRoleIds = autoRoleConfig.roleIds.slice(1);

        for (const roleId of userRoleIds) {
          const userRole = guild.roles.cache.get(roleId);
          if (userRole) {
            await member.roles.add(userRole);
          } else {
            console.log(`Role with ID ${roleId} does not exist in guild ${guild.name}`);
          }
        }
      }
    }
  } catch (error) {
    console.log(`Error giving roles automatically: ${error}`);
  }
};
