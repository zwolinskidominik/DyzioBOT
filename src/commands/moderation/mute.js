const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
  data: {
    name: 'mute',
    description: 'Wysyła użytkownika na wakacje od serwera.',
    options: [
      {
        name: 'target-user',
        description: "Użytkownik, którego chcesz zmute'ować.",
        type: ApplicationCommandOptionType.Mentionable,
        required: true,
      },
      {
        name: 'duration',
        description: 'Czas trwania mute (30min, 1h, 1 dzień).',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: '15 min',
            value: '15 min',
          },
          {
            name: '30 min',
            value: '30 min',
          },
          {
            name: '1 godz.',
            value: '1 hour',
          },
          {
            name: '1 dzień',
            value: '1 day',
          },
          {
            name: '1 tydzień',
            value: '1 week',
          },
        ],
      },
      {
        name: 'reason',
        description: "Powód mute'a.",
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const mentionable = interaction.options.get('target-user').value;
    const duration = interaction.options.get('duration').value;
    const reason = interaction.options.get('reason')?.value || 'Brak powodu.';

    let embed = new EmbedBuilder().setColor('#990f02');

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(mentionable);

    if (!targetUser) {
      embed
        .setDescription('**Nie znaleziono podanego użytkownika na serwerze.**')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    if (targetUser.user.bot) {
      embed
        .setDescription("**Nie mogę zmute'ować bota.**")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    const msDuration = ms(duration);

    if (isNaN(msDuration)) {
      embed
        .setDescription("**Podaj prawidłową wartość czasu trwania mute'a.**")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    if (msDuration < 5000 || msDuration > 2.419e9) {
      embed
        .setDescription(
          '**Mute nie może być krótszy niż 5 sekund oraz dłuższy niż 28 dni.**'
        )
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; //Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; //Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; //Highest role of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      embed
        .setDescription(
          "**Nie możesz zmute'ować użytkownika, ponieważ ma taką samą lub wyższą rolę.**"
        )
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      embed
        .setDescription(
          "**Nie mogę zmute'ować tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie.**"
        )
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
      return;
    }

    try {
      const { default: prettyMs } = await import('pretty-ms');

      if (targetUser.isCommunicationDisabled()) {
        await targetUser.timeout(msDuration, reason);
        embed
          .setDescription(
            `Czas mute'a ${targetUser} został zaktualizowany: **${prettyMs(
              msDuration
            )}**.\nPowód: **${reason}**`
          )
          .setColor('#32CD03')
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });
        interaction.editReply({ embeds: [embed] });
        return;
      }

      await targetUser.timeout(msDuration, reason);
      embed
        .setDescription(
          `${targetUser} został zmute'owany na okres **${prettyMs(
            msDuration
          )}**.\nPowód: **${reason}**`
        )
        .setColor('#32CD03')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply('Wystąpił błąd');
      console.log(`Wystąpił błąd podczas mute'owania: ${error}`);
    }
  },

  options: {
    permissionsRequired: ['MuteMembers'],
    botPermissions: ['MuteMembers'],
  },
};
