const { Client, GuildMember } = require('discord.js');
const AutoRole = require('../../models/AutoRole');

/**
 *
 * @param {Client} client
 * @param {GuildMember} member
 */
module.exports = async (client, member) => {
  try {
    let guild = member.guild;
    if (!guild) return;

    // Check if a roles are configured
    const autoRole = await AutoRole.findOne({ guildId: guild.id });

    if (autoRole && autoRole.roleIds.length > 0) {
      // Check if the user who joined is a bot
      if (member.user.bot) {
        // Get the 'Bot' role with specified ID
        const botRoleId = autoRole.roleIds[0];
        const botRole = guild.roles.cache.get(botRoleId);

        // Check if the bot role exists
        if (botRole) {
          // Add the bot role to the bot
          await member.roles.add(botRole).catch((error) => {
            console.log(`Error adding bot role to ${member.user.tag} : ${error}`);
          });
          console.log(`Bot role added successfully to ${member.user.tag}`);
        } else {
          console.log(`Bot role does not exist or is not configured for ${guild.name}`);
        }
      } else {
        // Get the 'User' role with specified ID
        for (const roleId of autoRole.roleIds.slice(1)) {
          await member.roles.add(roleId).catch((error) => {
            console.log(`Error adding role ${roleId} : ${error}`);
          });
        }
      }
    }
  } catch (error) {
    console.log(`Error giving roles automatically: ${error}`);
  }
};