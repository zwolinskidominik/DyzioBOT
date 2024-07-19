const Suggestion = require("../../models/Suggestion");
const formatResults = require("../../utils/formatResults");

module.exports = async (interaction) => {
  if (!interaction.isButton() || !interaction.customId) return;

  try {
    const [type, suggestionId, action] = interaction.customId.split(".");
    if (type !== "suggestion" || !suggestionId || !action) return;

    await interaction.deferReply({ ephemeral: true });

    const targetSuggestion = await Suggestion.findOne({ suggestionId });
    if (!targetSuggestion) {
      await interaction.editReply("Sugestia nie została znaleziona.");
      return;
    }

    const targetMessage = await interaction.channel.messages.fetch(
      targetSuggestion.messageId
    );
    if (!targetMessage || !targetMessage.embeds.length) {
      await interaction.editReply(
        "Wiadomość docelowa nie zawiera żadnych osadzonych treści."
      );
      return;
    }

    const targetMessageEmbed = targetMessage.embeds[0];

    const alreadyVoted =
      targetSuggestion.upvotes.includes(interaction.user.id) ||
      targetSuggestion.downvotes.includes(interaction.user.id);
    if (alreadyVoted) {
      await interaction.editReply("Oddano już głos na tę sugestię.");
      return;
    }

    if (action === "upvote") {
      targetSuggestion.upvotes.push(interaction.user.id);
      targetSuggestion.upvoteUsernames.push(interaction.user.username);
      await interaction.editReply("Oddano głos na tak!");
    } else if (action === "downvote") {
      targetSuggestion.downvotes.push(interaction.user.id);
      targetSuggestion.downvoteUsernames.push(interaction.user.username);
      await interaction.editReply("Oddano głos na nie!");
    }

    await targetSuggestion.save();

    targetMessageEmbed.fields[1].value = formatResults(
      targetSuggestion.upvotes,
      targetSuggestion.downvotes
    );
    await targetMessage.edit({ embeds: [targetMessageEmbed] });
  } catch (error) {
    console.log(`Error in handleSuggestion.js: ${error}`);
  }
};
