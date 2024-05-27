const { EmbedBuilder } = require('discord.js');
const Birthday = require('../../../models/Birthday');

module.exports = {
  data: {
    name: 'next-birthdays',
    description: 'Wyświetla następne 10 urodzin użytkowników.',
  },

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guild.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to local midnight

      const birthdays = await Birthday.find({ guildId }).sort({ date: 1 });

      const upcomingBirthdays = birthdays
        .map((birthday) => {
          const birthdayDate = new Date(birthday.date);
          const yearSpecified = birthday.yearSpecified;

          const nextBirthday = new Date(
            today.getFullYear(),
            birthdayDate.getMonth(),
            birthdayDate.getDate()
          );

          if (nextBirthday < today) {
            nextBirthday.setFullYear(today.getFullYear() + 1);
          }

          const age = yearSpecified ? nextBirthday.getFullYear() - birthdayDate.getFullYear() : null;
          const user = interaction.guild.members.cache.get(birthday.userId)?.user;

          return {
            user,
            date: nextBirthday,
            age,
          };
        })
        .filter((birthday) => birthday.user)
        .sort((a, b) => a.date - b.date)
        .slice(0, 10);

      const successEmbed = new EmbedBuilder().setColor('#00BFFF');

      if (upcomingBirthdays.length === 0) {
        successEmbed.setDescription('Brak nadchodzących urodzin.');
        await interaction.editReply({ embeds: [successEmbed] });
        return;
      }

      successEmbed
        .setTitle('Nadchodzące urodziny')
        .setDescription(
          upcomingBirthdays
            .map(
              (birthday) =>
                `**${birthday.date.toLocaleDateString('pl-PL', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}**\n${birthday.user} ${birthday.age !== null ? `(${birthday.age})` : ''}`
            )
            .join('\n\n')
        );

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas pobierania nadchodzących urodzin: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('Wystąpił błąd podczas pobierania nadchodzących urodzin.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
