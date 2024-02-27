const { Client, Interaction, PermissionFlagsBits } = require("discord.js");
const AutoRole = require("../../models/AutoRole");

module.exports = {
  /**
   *
   * @param {Client} client
   * @param {Interaction} interaction
   */

  callback: async (client, interaction) => {
    try {
      await interaction.deferReply();

      if (!(await AutoRole.exists({ guildId: interaction.guild.id }))) {
        interaction.editReply(
          "Autorole nie są skonfigurowane. Aby skonfigurować, uruchom `/autorole-configure`."
        );
        return;
      }

      await AutoRole.findOneAndDelete({ guildId: interaction.guild.id });
      interaction.editReply(
        "Autorole zostały wyłączone dla tego serwera. Aby skonfigurować, uruchom `/autorole-configure`."
      );
    } catch (error) {
      console.log(error);
    }
  },

  name: "autorole-disable",
  description: "Wyłącz autorole dla tego serwera",
  permissionsRequired: [PermissionFlagsBits.Administrator],
};
