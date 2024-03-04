const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const AutoRole = require('../../models/AutoRole');

module.exports = {
  data: {
    name: 'autorole-configure',
    description: 'Skonfiguruj autorole dla serwera.',
    options: [
      {
        name: 'role1',
        description: 'Rola która ma być nadawana botom.',
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
      {
        name: 'role2',
        description: 'Rola, która ma być nadawana nowym członkom.',
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
      {
        name: 'role3',
        description: 'Rola 3 (opcjonalna)',
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: 'role4',
        description: 'Rola 4 (opcjonalna)',
        type: ApplicationCommandOptionType.Role,
        required: false,
      },
      {
        name: 'role5',
        description: 'Rola 5 (opcjonalna)',
        type: ApplicationCommandOptionType.Role,
        required: false,
      }
    ],
  },

  run: async ({ interaction, client, handler }) => {
    if (!interaction.inGuild()) {
      interaction.reply('You can only run this command inside a server.');
      return;
    }

    const roles = [];
    for (let i = 1; i <= 6; i++) {
      const roleOption = interaction.options.get(`role${i}`);
      if (roleOption) {
        const role = roleOption.role;
        // Check if the selected role is @everyone
        if (role.id === interaction.guild?.id) {
          interaction.reply('Nie można skonfigurować roli `@everyone`.');
          return;
        }
        roles.push(roleOption.value);
      } else {
        break;
      }
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
      interaction.editReply(
        'Autorole zostały skonfigurowane. Aby wyłączyć, uruchom `autorole-disable`'
      );
    } catch (error) {
      console.log(`Wystąpił błąd podczas konfigurowania autoroli: ${error}`);
    }
  },

  options: {
    devOnly: false,
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },
};
