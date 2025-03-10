const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emoji-steal")
    .setDescription("Dodaje wiele emoji z innego serwera.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("emojis")
        .setDescription("Podaj jedno lub więcej niestandardowych emoji, oddzielonych spacją.")
        .setRequired(true)
    ),

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const emojisInput = interaction.options.getString("emojis");
      const splitted = emojisInput.trim().split(/\s+/);

      const regex = /^<(?<animated>a?):(?<name>\w+):(?<id>\d+)>$/;
      const results = [];

      for (const token of splitted) {
        const match = token.match(regex);
        if (!match || !match.groups) {
          results.push(`❌ \`${token}\`: Niepoprawny format!`);
          continue;
        }

        const { animated, name, id } = match.groups;
        const isAnimated = animated === "a";
        const emojiURL = `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? "gif" : "png"}`;

        try {
          const newEmoji = await interaction.guild.emojis.create({
            attachment: emojiURL,
            name,
          });
          results.push(`✅ \`${token}\`: Dodano jako ${newEmoji}`);
        } catch (error) {
          logger.warn(`Błąd podczas dodawania emoji: ${error}`);
          results.push(`❌ \`${token}\`: Błąd przy dodawaniu (limit emoji / brak uprawnień?).`);
        }
      }

      const embed = createBaseEmbed({
        title: "Wynik dodawania emoji",
        description: results.join("\n"),
        color: "#00BFFF",
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(`Błąd podczas dodawania wielu emoji: ${error}`);
      try {
        await interaction.editReply({
          content:
            "Wystąpił błąd podczas dodawania emoji. Upewnij się, że bot posiada uprawnienia do zarządzania emoji oraz że format jest poprawny.",
        });
      } catch (err) {
        logger.error(`Nie można edytować odpowiedzi: ${err}`);
      }
    }
  },
};
