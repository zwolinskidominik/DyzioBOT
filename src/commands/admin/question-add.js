const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Question = require("../../models/Question");

// Funkcja do walidacji emoji
const isValidEmoji = (reaction) => {
  const emojiRegex = /^(\p{Emoji}|\p{Emoji_Component})+$/u;
  const discordEmojiRegex = /^<a?:[a-zA-Z0-9_]+:[0-9]+>$/;
  return emojiRegex.test(reaction) || discordEmojiRegex.test(reaction);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question-add")
    .setDescription("Dodaj pytanie.")
    .addStringOption(
      (option) =>
        option
          .setName("question")
          .setDescription("Treść pytania.")
          .setRequired(true)
          .setMaxLength(1000) // Limit długości pytania
    )
    .addStringOption((option) =>
      option
        .setName("reactions")
        .setDescription("Reakcje na pytanie (oddzielone spacją).")
        .setRequired(true)
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const question = interaction.options.getString("question").trim();
    const reactionsInput = interaction.options.getString("reactions").trim();

    // Walidacja pytania
    if (question.length < 5) {
      return await interaction.reply({
        embeds: [
          errorEmbed.setDescription("Pytanie musi mieć co najmniej 5 znaków."),
        ],
        ephemeral: true,
      });
    }

    // Walidacja reakcji
    const reactions = reactionsInput.split(/\s+/).filter(Boolean); // Podział po białych znakach i usunięcie pustych ciągów
    if (reactions.length < 2 || reactions.length > 5) {
      return await interaction.reply({
        embeds: [errorEmbed.setDescription("Musisz podać od 2 do 5 reakcji.")],
        ephemeral: true,
      });
    }

    // Walidacja każdej reakcji
    const invalidReactions = reactions.filter(
      (reaction) => !isValidEmoji(reaction)
    );
    if (invalidReactions.length > 0) {
      return await interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            `Następujące reakcje są nieprawidłowe: ${invalidReactions.join(
              ", "
            )}`
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      const questionModel = new Question({
        authorId: interaction.user.id,
        content: question,
        reactions,
      });

      await questionModel.save();

      await interaction.reply({
        embeds: [successEmbed.setDescription("Pomyślnie dodano pytanie dnia!")],
        ephemeral: true,
      });
    } catch (error) {
      console.error(`Błąd podczas dodawania pytania: ${error}`);
      await interaction.reply({
        embeds: [
          errorEmbed.setDescription(
            `Wystąpił błąd podczas dodawania pytania: ${error.message}`
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
