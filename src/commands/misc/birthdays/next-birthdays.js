const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Birthday = require("../../../models/Birthday");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("next-birthdays")
    .setDescription("Wyświetla następne 10 urodzin użytkowników.")
    .setDMPermission(false),

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    try {
      await interaction.deferReply();

      const guildId = interaction.guild.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const birthdays = await Birthday.find({ guildId }).sort({ date: 1 });

      const upcomingBirthdays = birthdays
        .map((birthday) => {
          const birthdayDate = new Date(birthday.date);
          const nextBirthday = new Date(
            today.getFullYear(),
            birthdayDate.getMonth(),
            birthdayDate.getDate()
          );

          if (nextBirthday < today) {
            nextBirthday.setFullYear(today.getFullYear() + 1);
          }

          const age = birthday.yearSpecified
            ? nextBirthday.getFullYear() - birthdayDate.getFullYear()
            : null;
          const user = interaction.guild.members.cache.get(
            birthday.userId
          )?.user;

          return {
            user,
            date: nextBirthday,
            age,
          };
        })
        .filter((birthday) => birthday.user)
        .sort((a, b) => a.date - b.date)
        .slice(0, 10);

      if (upcomingBirthdays.length === 0) {
        successEmbed.setDescription("Brak nadchodzących urodzin.");
      } else {
        successEmbed.setTitle("Nadchodzące urodziny").setDescription(
          upcomingBirthdays
            .map(
              (birthday) =>
                `**${birthday.date.toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}**\n${birthday.user} ${
                  birthday.age !== null ? `(${birthday.age})` : ""
                }`
            )
            .join("\n\n")
        );
      }

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas pobierania nadchodzących urodzin: ${error}`);

      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas pobierania nadchodzących urodzin."
          ),
        ],
      });
    }
  },
};
