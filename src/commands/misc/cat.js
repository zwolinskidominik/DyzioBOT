const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { request } = require("undici");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cat")
    .setDescription("Wysyła losowe zdjęcie kota."),

  run: async ({ interaction }) => {
    await interaction.deferReply();
    const catResult = await request(
      "https://api.thecatapi.com/v1/images/search"
    );
    const res = await catResult.body.json();

    const catEmbed = new EmbedBuilder()
      .setImage(res[0].url)
      .setTitle("Losowy kotek")
      .setFooter({
        text: "Utworzone poprzez API z thecatapi.com - ID: " + res[0].id,
      })
      .setColor("#00BFFF");

    interaction.followUp({ embeds: [catEmbed] });
  },
};
