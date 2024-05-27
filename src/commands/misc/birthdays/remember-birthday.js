const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const Birthday = require('../../../models/Birthday');

const errorEmbed = new EmbedBuilder()
  .setColor('#FF0000');

module.exports = {
  data: {
    name: 'remember-birthday',
    description: 'Ustawia datę urodzin użytkownika.',
    options: [
      {
        name: 'date',
        description: 'Data urodzin w formacie DD-MM-YYYY lub DD-MM.',
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const dateString = interaction.options.get('date').value;
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const datePatternWithYear = /^\d{2}-\d{2}-\d{4}$/;
    const datePatternWithoutYear = /^\d{2}-\d{2}$/;

    let date, yearSpecified = true;

    if (datePatternWithYear.test(dateString)) {
      const [day, month, year] = dateString.split('-');
      date = new Date(`${year}-${month}-${day}`);
    } else if (datePatternWithoutYear.test(dateString)) {
      const [day, month] = dateString.split('-');
      date = new Date(`1970-${month}-${day}`); // Use a placeholder year for storage
      yearSpecified = false;
    } else {
      errorEmbed.setDescription('Niepoprawny format daty. Użyj formatu `DD-MM-YYYY` lub `DD-MM`.');
      await interaction.reply({ embeds: [errorEmbed] });
      return;
    }

    try {
      await interaction.deferReply();

      const birthday = await Birthday.findOne({ userId, guildId });

      if (birthday) {
        birthday.date = date;
        birthday.yearSpecified = yearSpecified;
      } else {
        birthday = new Birthday({ userId, guildId, date, yearSpecified });
      }

      await birthday.save();

      // Calculate days until next birthday
      const today = new Date();
      const nextBirthday = new Date(today.getFullYear(), date.getMonth(), date.getDate());
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = Math.abs(nextBirthday - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const formattedDate = nextBirthday.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(`Zanotowano, **kolejne** urodziny <@${userId}> już za **${diffDays}** dni, **${formattedDate}** 🎂.`);
      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas zapisywania daty urodzin: ${error}`);

      errorEmbed.setDescription('Wystąpił błąd podczas zapisywania daty urodzin.');
      await interaction.reply({ embeds: [errorEmbed] });
    }
  },
};
