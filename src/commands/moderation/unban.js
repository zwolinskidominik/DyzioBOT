const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,
  } = require("discord.js");
  
  module.exports = {
    /**
     * 
     * @param {Client} client 
     * @param {Interaction} interaction 
     */
    callback: async (client, interaction) => {
      const targetUserId = interaction.options.get('target-user').value;

      await interaction.deferReply();

      const bannedUsers = await interaction.guild.bans.fetch();

      let bannedId = bannedUsers.find(user => user.user.id === targetUserId);

      if (!bannedId) {
        await interaction.editReply("Nie znaleziono użytkownika na liście banów");
        return;
      }

      const targetUser = bannedId.user.username;

      // Unban the target user
      try {
        await interaction.guild.bans.remove(targetUserId);
        return interaction.editReply(`Użytkownik **${targetUser}** został odbanowany`);
      } catch (error) {
        console.log(`Wystąpił błąd podczas próby odbanowania: ${error}`);
        return interaction.editReply("Wystąpił błąd podczas odbanowywania użytkownika.");
      }
    },
  
    name: "unban",
    description: "Odbanowuje użytkownika na serwerze.",
    options: [
      {
        name: "target-user",
        description: "Użytkownik, którego chcesz odbanować.",
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
    permissionsRequired: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
  };
  