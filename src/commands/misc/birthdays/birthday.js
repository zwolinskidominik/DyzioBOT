const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const Birthday = require('../../../models/Birthday');

module.exports = {
  data: {
    name: 'birthday',
    description: 'Sprawdza datę urodzin twoją lub innego użytkownika.',
    options: [
      {
        name: 'target-user',
        description: 'Użytkownik, którego datę urodzin chcesz sprawdzić.',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },

  run: async ({ interaction }) => {
    const targetUser = interaction.options.get('target-user')?.user || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guild.id;

    const errorEmbed = new EmbedBuilder().setColor('#FF0000');

    try {
      await interaction.deferReply();

      const birthday = await Birthday.findOne({ userId, guildId });

      if (!birthday) {
        errorEmbed
          .setDescription(`Nie znam **jeszcze** daty urodzin ${targetUser}.\n\nUżyj /remember-birthday lub /set-user-birthday, aby ustawić datę urodzin.`)
          .addFields(
            { name: 'Przykłady:', value: ' - /remember-birthday 15-04\n- /remember-birthday 13-09-2004\n- /set-user-birthday 15-04-1994 @Dyzio' }
          );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const today = new Date();
      const birthdayDate = new Date(birthday.date);
      const yearSpecified = birthday.yearSpecified;
      let age = yearSpecified ? today.getFullYear() - birthdayDate.getFullYear() : null;

      const nextBirthday = new Date(today.getFullYear(), birthdayDate.getMonth(), birthdayDate.getDate());
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
        if (yearSpecified) {
          age += 1; // Adjust age for the upcoming birthday
        }
      }

      const diffTime = Math.abs(nextBirthday - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const fullDate = nextBirthday.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(yearSpecified 
          ? `**${age}** urodziny ${targetUser} są za **${diffDays}** dni, **${fullDate}** 🎂` 
          : `**Następne** urodziny ${targetUser} są za **${diffDays}** dni, **${fullDate}** 🎂`);

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas sprawdzania daty urodzin: ${error}`);

      errorEmbed.setDescription('Wystąpił błąd podczas sprawdzania daty urodzin.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
