const { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'unban',
    description: 'Odbanowuje użytkownika na serwerze.',
    options: [{
      name: 'target-user',
      description: 'Użytkownik, którego chcesz odbanować.',
      required: true,
      type: ApplicationCommandOptionType.String,
    }, ],
  },
  run: async ({ interaction }) => {
    const targetUserId = interaction.options.get('target-user').value;

    await interaction.deferReply();

    const bannedUsers = await interaction.guild.bans.fetch();
    let bannedId = bannedUsers.find((user) => user.user.id === targetUserId);

    if (!bannedId) {
      embed
        .setDescription('**Nie znaleziono użytkownika na liście banów.**')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    let embed = new EmbedBuilder().setColor('#990f02');
    const targetUser = bannedId.user.username;

    // Unban the target user
    try {
      await interaction.guild.bans.remove(targetUserId);
      embed
        .setDescription(`Użytkownik **${targetUser}** został odbanowany`)
        .setTimestamp()
        .setColor('#32CD03')
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas próby odbanowania: ${error}`);
      embed
        .setDescription('**Wystąpił błąd podczas odbanowywania użytkownika.**')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }
  },

  options: {
    permissionsRequired: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
  },
};