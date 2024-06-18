const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const AutoRole = require("../../models/AutoRole");

module.exports = {
  data: {
    name: "autorole-configure",
    description: "Skonfiguruj autorole dla serwera.",
    options: [
      {
        name: "role1",
        description: "Rola która ma być nadawana botom.",
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
      {
        name: "role2",
        description: "Rola, która ma być nadawana nowym członkom.",
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
      {
        name: "role3",
        description: "Rola 3 (opcjonalna)",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "role4",
        description: "Rola 4 (opcjonalna)",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "role5",
        description: "Rola 5 (opcjonalna)",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: "role6",
        description: "Rola 6 (opcjonalna)",
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
    ],
  },

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription("You can only run this command inside a server.");
      await interaction.reply({ embeds: [errorEmbed] });
      return;
    }

    const roles = [];
    for (const role of interaction.options.data) {
      const selectedRole = role.role;

      // Check if the selected role is @everyone
      if (selectedRole.id === interaction.guild.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription("Nie można skonfigurować roli `@everyone`.");
        await interaction.reply({ embeds: [errorEmbed] });
        return;
      }
      roles.push(selectedRole.id);
    }

    try {
      await interaction.deferReply();

      let autoRole = await AutoRole.findOne({ guildId: interaction.guild.id });

      if (autoRole) {
        autoRole.roleIds = roles;
      } else {
        autoRole = new AutoRole({
          guildId: interaction.guild.id,
          roleIds: roles,
        });
      }

      await autoRole.save();

      const successEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setDescription(
          "Autorole zostały skonfigurowane. Aby wyłączyć, uruchom `autorole-disable`"
        );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas konfigurowania autoroli: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription("Wystąpił błąd podczas konfigurowania autoroli.");
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  options: {
    userPermissions: ["Administrator"],
    botPermissions: ["Administrator"],
  },
};
