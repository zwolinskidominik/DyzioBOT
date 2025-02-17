const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

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
        return createBaseEmbed({
          title: `Emoji (Strona ${page + 1} z ${pages})`,
          description: emojiList,
          color: "#00BFFF",
        });
      };

      let components = [];
      let message;

      if (pages > 1) {
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
        components = [row];

        message = await interaction.reply({
          embeds: [generateEmbed(currentPage)],
          components: components,
          fetchReply: true,
        });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
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
            components: components,
          });
        });

        collector.on("end", async () => {
          row.components.forEach((btn) => btn.setDisabled(true));
          try {
            await message.edit({ components: [row] });
          } catch (error) {
            logger.warn(
              `Nie udało się zedytować wiadomości /emoji po end: ${error}`
            );
          }
        });
      } else {
        message = await interaction.reply({
          embeds: [generateEmbed(currentPage)],
          fetchReply: true,
        });
      }
    } catch (error) {
      logger.error(`Błąd podczas wyświetlania emoji: ${error}`);
      await interaction.reply({
        content: "Wystąpił błąd podczas wyświetlania emoji.",
        ephemeral: true,
      });
    }
  },
};
