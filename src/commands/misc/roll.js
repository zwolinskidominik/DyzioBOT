const { SlashCommandBuilder } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription(
      "Rzuć kością, domyślnie 6-ścienną lub podaj liczbę ścianek."
    )
    .addIntegerOption((option) =>
      option
        .setName("sides")
        .setDescription("Liczba ścianek kostki (np. 20 dla D20)")
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    try {
      const sides = interaction.options.getInteger("sides") || 6;

      if (sides < 2) {
        await interaction.reply("Kostka musi mieć co najmniej 2 ścianki.");
        return;
      }

      const result = Math.floor(Math.random() * sides) + 1;

      await interaction.reply(`:game_die: ${result} (1 - ${sides})`);
    } catch (error) {
      logger.error(`Błąd podczas wykonywania komendy /roll: ${error}`);
      await interaction.reply({
        content: "Wystąpił błąd podczas rzucania kostką.",
        ephemeral: true,
      });
    }
  },
};
