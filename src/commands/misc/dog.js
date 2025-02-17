const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const { request } = require("undici");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dog")
    .setDescription("Wysyła losowe zdjęcie psa"),

  run: async ({ interaction }) => {
    await interaction.deferReply();
    try {
      const dogResult = await request(
        "https://api.thedogapi.com/v1/images/search"
      );
      const res = await dogResult.body.json();

      if (!res || !res.length) {
        logger.warn("API thedogapi.com zwróciło pustą odpowiedź.");
        return interaction.followUp({
          content: "Nie udało się pobrać zdjęcia psa. Spróbuj ponownie.",
        });
      }

      const dogEmbed = createBaseEmbed({
        title: "Losowy piesek",
        footerText: "Utworzone poprzez API z thedogapi.com - ID: " + res[0].id,
        image: res[0].url,
        color: "#00BFFF",
      });

      interaction.followUp({ embeds: [dogEmbed] });
    } catch (error) {
      logger.error(`Błąd podczas pobierania zdjęcia psa: ${error}`);
      await interaction.followUp({
        content: "Wystąpił błąd przy próbie pobrania zdjęcia psa.",
        ephemeral: true,
      });
    }
  },
};
