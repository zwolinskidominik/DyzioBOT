const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../../utils/embedUtils");
const Birthday = require("../../../models/Birthday");
const logger = require("../../../utils/logger");
const emoji = "<a:bday:1341064272549249116>";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-user-birthday")
    .setDescription("Ustawia datę urodzin innego użytkownika.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Użytkownik, którego datę urodzin chcesz ustawić.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Data urodzin w formacie DD-MM-YYYY lub DD-MM.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [],
    botPermissions: [],
  },

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

    const dateString = interaction.options.getString("date");
    const userOption = interaction.options.getUser("user");
    const userId = userOption.id;
    const guildId = interaction.guild.id;

    if (userId === interaction.user.id) {
      await interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            "Aby ustawić urodziny dla siebie użyj komendy /remember-birthday."
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const datePatternWithYear = /^\d{2}-\d{2}-\d{4}$/;
    const datePatternWithoutYear = /^\d{2}-\d{2}$/;

    let date,
      yearSpecified = true;
    if (datePatternWithYear.test(dateString)) {
      const [day, month, year] = dateString.split("-");
      date = new Date(`${year}-${month}-${day}`);
    } else if (datePatternWithoutYear.test(dateString)) {
      const [day, month] = dateString.split("-");
      date = new Date(`1970-${month}-${day}`);
      yearSpecified = false;
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            "Niepoprawny format daty. Użyj formatu `DD-MM-YYYY` lub `DD-MM`."
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (isNaN(date.getTime())) {
      await interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            "Niepoprawna data. Użyj prawidłowej daty w formacie `DD-MM-YYYY` lub `DD-MM`."
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply();

      const updatedBirthday = await Birthday.findOneAndUpdate(
        { userId, guildId },
        { date, yearSpecified },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const birthdayDate = new Date(updatedBirthday.date);

      const isTodayBirthday =
        today.getMonth() === birthdayDate.getMonth() &&
        today.getDate() === birthdayDate.getDate();

      const nextBirthday = new Date(
        today.getFullYear(),
        birthdayDate.getMonth(),
        birthdayDate.getDate()
      );
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = nextBirthday - today;
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

      const outputMessage = isTodayBirthday
        ? `Zanotowano, **${ageMessage}** urodziny <@!${userId}> są dziś! Wszystkiego najlepszego! ${emoji}`
        : yearSpecified
        ? `Zanotowano, **${ageMessage}** urodziny <@!${userId}> już za **${diffDays}** dni, **${formattedDate}** 🎂.`
        : `Zanotowano, **Następne** urodziny <@!${userId}> są za **${diffDays}** dni, **${formattedDate}** 🎂.`;

      await interaction.editReply({
        embeds: [successEmbed.setDescription(outputMessage)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error(
        `Błąd podczas zapisywania daty urodzin (userId=${userId}): ${error}`
      );
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas zapisywania daty urodzin."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
