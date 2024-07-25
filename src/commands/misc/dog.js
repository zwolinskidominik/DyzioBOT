const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { request } = require("undici");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dog")
    .setDescription("Wysyła losowe zdjęcie psa"),

  run: async ({ interaction }) => {
    await interaction.deferReply();
    const dogResult = await request(
      "https://api.thedogapi.com/v1/images/search"
    );
    const res = await dogResult.body.json();

    const dogEmbed = new EmbedBuilder()
      .setImage(res[0].url)
      .setTitle("Losowy piesek")
      .setFooter({
        text: "Utworzone poprzez API z thedogapi.com - ID: " + res[0].id,
      })
      .setColor("#00BFFF");

    interaction.followUp({ embeds: [dogEmbed] });
  },
};
