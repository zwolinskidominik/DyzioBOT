const AutoRole = require('../../models/AutoRole');

module.exports = {
  data: {
    name: 'autorole-disable',
    description: 'Wyłącz autorole dla tego serwera',
  },

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();

      if (!(await AutoRole.exists({ guildId: interaction.guild.id }))) {
        interaction.editReply(
          'Autorole nie są skonfigurowane. Aby skonfigurować, uruchom `/autorole-configure`.'
        );
        return;
      }

      await AutoRole.findOneAndDelete({ guildId: interaction.guild.id });
      interaction.editReply(
        'Autorole zostały wyłączone dla tego serwera. Aby skonfigurować, uruchom `/autorole-configure`.'
      );
    } catch (error) {
      console.log(`Wystąpił błąd podczas wyłączania autoroli dla tego serwera: ${error}`);
    }
  },

  options: {
    userPermissions: ['Administrator'],
    botPermissions: ['Administrator'],
  },
};
