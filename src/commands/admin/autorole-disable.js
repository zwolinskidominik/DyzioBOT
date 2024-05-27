const { EmbedBuilder } = require('discord.js');
const AutoRole = require('../../models/AutoRole');

module.exports = {
  data: {
    name: 'autorole-disable',
    description: 'Wyłącz autorole dla tego serwera',
  },

  run: async ({ interaction }) => {
    if (!interaction.inGuild()) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('You can only run this command inside a server.');
      await interaction.reply({ embeds: [errorEmbed] });
      return;
    }

    try {
      await interaction.deferReply();

      if (!(await AutoRole.exists({ guildId: interaction.guild.id }))) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('Autorole nie są skonfigurowane. Aby skonfigurować, uruchom `/autorole-configure`.');
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      await AutoRole.findOneAndDelete({ guildId: interaction.guild.id });

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription('Autorole zostały wyłączone dla tego serwera. Aby skonfigurować, uruchom `/autorole-configure`.');
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas wyłączania autoroli dla tego serwera: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('Wystąpił błąd podczas wyłączania autoroli.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  options: {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
  },
};
