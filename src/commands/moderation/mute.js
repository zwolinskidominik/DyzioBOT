const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const ms = require('ms');

const errorEmbed = new EmbedBuilder()
  .setColor('#FF0000')
  .setTimestamp()
  .setFooter({ text: interaction.guild.name });

const successEmbed = new EmbedBuilder()
  .setColor('#00BFFF')
  .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
  .setTimestamp()
  .setFooter({ text: interaction.guild.name });

module.exports = {
  data: {
    name: 'mute',
    description: 'Wysyła użytkownika na wakacje od serwera.',
    options: [
      {
        name: 'target-user',
        description: "Użytkownik, którego chcesz wyciszyć.",
        type: ApplicationCommandOptionType.Mentionable,
        required: true,
      },
      {
        name: 'duration',
        description: 'Czas trwania wyciszenia (30min, 1h, 1 dzień).',
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
        description: "Powód wyciszenia.",
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const targetUser = interaction.options.get('target-user').value;
    const duration = interaction.options.get('duration').value;
    const reason = interaction.options.get('reason')?.value || 'Brak powodu.';

    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser);

    if (!member) {
      errorEmbed.setDescription('**Taki użytkownik nie istnieje na tym serwerze.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (member.id === interaction.guild.ownerId) {
      errorEmbed.setDescription('**Nie możesz wyciszyć tego użytkownika, ponieważ jest on właścicielem serwera.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (member.user.bot) {
      errorEmbed.setDescription("**Nie mogę wyciszyć bota.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const msDuration = ms(duration);

    if (isNaN(msDuration)) {
      errorEmbed.setDescription("**Podaj prawidłową wartość czasu trwania wyciszenia.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (msDuration < 5000 || msDuration > 2.419e9) {
      errorEmbed.setDescription('**Czas wyciszenia nie może być krótszy niż 5 sekund oraz dłuższy niż 28 dni.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const targetUserRolePosition = member.roles.highest.position; //Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; //Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; //Highest role of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      errorEmbed.setDescription("**Nie możesz wyciszyć użytkownika, ponieważ ma taką samą lub wyższą rolę.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      errorEmbed.setDescription("**Nie mogę wyciszyć tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    try {
      const { default: prettyMs } = await import('pretty-ms');

      if (member.isCommunicationDisabled()) {
        await member.timeout(msDuration, reason);

        successEmbed
          .setDescription(`**Czas wyciszenia ${member} został zaktualizowany: **${prettyMs(msDuration)}**`)
          .addFields(
            { name: 'Moderator:', value: `${interaction.user}`, inline: true },
            { name: 'Powód:', value: `${reason}`, inline: true }
          );

        interaction.editReply({ embeds: [successEmbed] });
        return;
      }

      await member.timeout(msDuration, reason);

      successEmbed
        .setDescription(`**${member} został wyciszony na okres ${prettyMs(msDuration)}**`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true },
          { name: 'Powód:', value: `${reason}`, inline: true }
        );

      interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas wysyłania użytkownika na przerwę: ${error}`);

      errorEmbed.setDescription('**Wystąpił błąd podczas wysyłania użytkownika na przerwę.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  },

  options: {
    permissionsRequired: ['MuteMembers'],
    botPermissions: ['MuteMembers'],
  },
};
