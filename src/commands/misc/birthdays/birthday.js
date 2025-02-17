const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../../utils/embedUtils");
const Birthday = require("../../../models/Birthday");
const logger = require("../../../utils/logger");
const emoji = "<a:bday:1341064272549249116>";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription(
      "Wyświetla Twoją datę urodzin lub datę urodzin innego użytkownika."
    )
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, którego datę urodzin chcesz sprawdzić.")
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

    const targetUser =
      interaction.options.getUser("target-user") || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply();

      const birthday = await Birthday.findOne({ userId, guildId });
      if (!birthday) {
        await interaction.editReply({
          embeds: [
            errorEmbed
              .setDescription(
                `Nie znam **jeszcze** daty urodzin ${targetUser}.\n\nUżyj </remember-birthday:1244599618617081864> lub </set-user-birthday:1244599618747109506>, aby ustawić datę urodzin.`
              )
              .addFields({
                name: "Przykłady:",
                value:
                  " - </remember-birthday:1244599618617081864> 15-04\n- </remember-birthday:1244599618617081864> 13-09-2004\n- </set-user-birthday:1244599618747109506> 15-04-1994 `@Dyzio`",
              }),
          ],
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const birthdayDate = new Date(birthday.date);
      const yearSpecified = birthday.yearSpecified;
      let age = yearSpecified
        ? today.getFullYear() - birthdayDate.getFullYear()
        : null;

      const nextBirthday = new Date(
        today.getFullYear(),
        birthdayDate.getMonth(),
        birthdayDate.getDate()
      );

      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
        if (yearSpecified) {
          age += 1;
        }
      }

      const diffTime = nextBirthday - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const fullDate = nextBirthday.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      let message;
      if (diffDays === 0) {
        message = yearSpecified
          ? `**${age}** urodziny ${targetUser} są dziś! Wszystkiego najlepszego! ${emoji}`
          : `Urodziny ${targetUser} są dziś! Wszystkiego najlepszego! ${emoji}`;
      } else {
        message = yearSpecified
          ? `**${age}** urodziny ${targetUser} są za **${diffDays}** dni, **${fullDate}** 🎂`
          : `**Następne** urodziny ${targetUser} są za **${diffDays}** dni, **${fullDate}** 🎂`;
      }

      await interaction.editReply({
        embeds: [successEmbed.setDescription(message)],
      });
    } catch (error) {
      logger.error(
        `Błąd podczas sprawdzania daty urodzin userId=${userId}: ${error}`
      );
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas sprawdzania daty urodzin."
          ),
        ],
      });
    }
  },
};
