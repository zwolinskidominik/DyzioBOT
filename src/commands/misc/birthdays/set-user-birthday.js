const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const Birthday = require('../../../models/Birthday');

module.exports = {
  data: {
    name: 'set-user-birthday',
    description: 'Ustawia datę urodzin innego użytkownika.',
    options: [
      {
        name: 'user',
        description: 'Użytkownik, którego datę urodzin chcesz ustawić.',
        required: true,
        type: ApplicationCommandOptionType.User,
      },
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
    const userId = interaction.options.get('user').value;
    const guildId = interaction.guild.id;

    const datePatternWithYear = /^\d{2}-\d{2}-\d{4}$/;
    const datePatternWithoutYear = /^\d{2}-\d{2}$/;

    let date, yearSpecified = true;

    const errorEmbed = new EmbedBuilder().setColor('#FF0000');

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

    if (isNaN(date.getTime())) {
      errorEmbed.setDescription('Niepoprawna data. Użyj prawidłowej daty w formacie `DD-MM-YYYY` lub `DD-MM`.');
      await interaction.reply({ embeds: [errorEmbed] });
      return;
    }

    try {
      await interaction.deferReply();

      let birthday = await Birthday.findOne({ userId, guildId });
      
      if (birthday) {
        birthday.date = date;
        birthday.yearSpecified = yearSpecified;
      } else {
        birthday = new Birthday({ userId, guildId, date, yearSpecified });
      }

      await birthday.save();

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
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas zapisywania daty urodzin: ${error}`);

      errorEmbed.setDescription('Wystąpił błąd podczas zapisywania daty urodzin.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
