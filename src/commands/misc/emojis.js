const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Wyświetla listę emoji na serwerze.")
    .setDMPermission(false),

  run: async ({ interaction }) => {
    try {
      const emojis = interaction.guild.emojis.cache.map(
        (e) => `${e} | \`${e}\``
      );
      const pageSize = 10;
      const pages = Math.ceil(emojis.length / pageSize);
      let currentPage = 0;

      const generateEmbed = (page) => {
        const start = page * pageSize;
        const end = start + pageSize;
        const emojiList =
          emojis.slice(start, end).join("\n\n") ||
          "Ten serwer nie posiada żadnych emoji.";

        return new EmbedBuilder()
          .setTitle(`Emoji (Strona ${page + 1} z ${pages})`)
          .setDescription(emojiList)
          .setColor("#00BFFF");
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Poprzednia")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Następna")
          .setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.reply({
        embeds: [generateEmbed(currentPage)],
        components: [row],
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        time: 60000,
      });

      collector.on("collect", async (btnInteraction) => {
        if (btnInteraction.customId === "previous") {
          currentPage = (currentPage - 1 + pages) % pages;
        } else if (btnInteraction.customId === "next") {
          currentPage = (currentPage + 1) % pages;
        }
        await btnInteraction.update({
          embeds: [generateEmbed(currentPage)],
          components: [row],
        });
      });

      collector.on("end", async () => {
        row.components.forEach((c) => c.setDisabled(true));
        await message.edit({ components: [row] });
      });
    } catch (error) {
      console.error("Błąd podczas wyświetlania emoji:", error);
      await interaction.reply({
        content: "Wystąpił błąd podczas wyświetlania emoji.",
        ephemeral: true,
      });
    }
  },
};
