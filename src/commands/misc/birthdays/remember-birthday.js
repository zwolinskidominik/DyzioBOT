const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Birthday = require("../../../models/Birthday");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remember-birthday")
    .setDescription("Ustawia datę urodzin użytkownika.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Data urodzin w formacie DD-MM-YYYY lub DD-MM.")
        .setRequired(true)
    ),

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const dateString = interaction.options.getString("date");
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const datePatternWithYear = /^\d{2}-\d{2}-\d{4}$/;
    const datePatternWithoutYear = /^\d{2}-\d{2}$/;

    let date;
    let yearSpecified = true;

    if (datePatternWithYear.test(dateString)) {
      const [day, month, year] = dateString.split("-");
      date = new Date(`${year}-${month}-${day}`);
    } else if (datePatternWithoutYear.test(dateString)) {
      const [day, month] = dateString.split("-");
      date = new Date(`1970-${month}-${day}`); // Placeholder if no year specified
      yearSpecified = false;
    } else {
      return interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            "Niepoprawny format daty. Użyj formatu `DD-MM-YYYY` lub `DD-MM`."
          ),
        ],
        ephemeral: true,
      });
    }

    if (isNaN(date.getTime())) {
      return interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            "Niepoprawna data. Użyj prawidłowej daty w formacie `DD-MM-YYYY` lub `DD-MM`."
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply();

      const filter = { userId, guildId };
      const update = { date, yearSpecified };
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };

      await Birthday.findOneAndUpdate(filter, update, options);

      const today = new Date();
      const nextBirthday = new Date(
        today.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = Math.abs(nextBirthday - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const formattedDate = nextBirthday.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      let ageMessage = "kolejne";
      if (yearSpecified) {
        const birthYear = date.getFullYear();
        const nextAge = nextBirthday.getFullYear() - birthYear;
        ageMessage = `${nextAge}`;
      }

      await interaction.editReply({
        embeds: [
          successEmbed.setDescription(
            `Zanotowano, **${ageMessage}** urodziny <@!${userId}> już za **${diffDays}** dni, **${formattedDate}** 🎂.`
          ),
        ],
      });
    } catch (error) {
      console.error(`Błąd podczas zapisywania daty urodzin: ${error}`, error);
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas zapisywania daty urodzin."
          ),
        ],
      });
    }
  },
};
