const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: {
    name: "kick",
    description: "Wyrzuca użytkownika z serwera.",
    options: [
      {
        name: "target-user",
        description: "Użytkownik, którego chcesz wyrzucić.",
        required: true,
        type: ApplicationCommandOptionType.Mentionable,
      },
      {
        name: "reason",
        description: "Powód wyrzucenia.",
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction, client, handler }) => {
    const targetUserId = interaction.options.get("target-user").value;
    const reason = interaction.options.get("reason")?.value || "Brak";

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(targetUserId);

    if (!targetUser) {
      await interaction.editReply(
        "Taki użytkownik nie istnieje na tym serwerze."
      );
      return;
    }

    if (targetUser.id === interaction.guild.ownerId) {
      await interaction.editReply(
        "Nie możesz wyrzucić tego użytkownika, ponieważ jest on właścicielem serwera."
      );
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; //Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; //Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; //Highest role of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      await interaction.editReply(
        "Nie możesz wyrzucić użytkownika, ponieważ ma taką samą lub wyższą rolę."
      );
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      await interaction.editReply(
        "Nie mogę wyrzucić tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie."
      );
      return;
    }

    // Kick the target user
    try {
      await targetUser.kick(reason);
      await interaction.editReply(
        `Użytkownik ${targetUser} został wyrzucony\nPowód: ${reason}`
      );
    } catch (error) {
      console.log(`Wystąpił błąd podczas wyrzucenia: ${error}`);
    }
  },

  options: {
    devOnly: false,
    permissionsRequired: [PermissionFlagsBits.KickMembers],
    botPermissions: [PermissionFlagsBits.KickMembers],
    deleted: false,
  },
};
