const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const { request } = require("undici");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cat")
    .setDescription("Wysyła losowe zdjęcie kota."),

  run: async ({ interaction }) => {
    await interaction.deferReply();
    try {
      const catResult = await request(
        "https://api.thecatapi.com/v1/images/search"
      );
      const res = await catResult.body.json();

      if (!res || !res.length) {
        logger.warn("API thecatapi.com zwróciło pustą odpowiedź.");
        return interaction.followUp({
          content: "Nie udało się pobrać zdjęcia kota. Spróbuj ponownie.",
        });
      }

      const catEmbed = createBaseEmbed({
        title: "Losowy kotek",
        footerText: "Utworzone poprzez API z thecatapi.com - ID: " + res[0].id,
        image: res[0].url,
        color: "#00BFFF",
      });

      interaction.followUp({ embeds: [catEmbed] });
    } catch (error) {
      logger.error(`Błąd podczas pobierania zdjęcia kota: ${error}`);
      await interaction.followUp({
        content: "Wystąpił błąd przy próbie pobrania zdjęcia kota.",
        ephemeral: true,
      });
    }
  },
};
