import { ButtonInteraction, TextChannel, MessageFlags } from 'discord.js';
import { vote, getSuggestion } from '../../services/suggestionService';
import { formatResults } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export default async function run(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.isButton() || !interaction.customId) return;

  try {
    const [type, suggestionId, action] = interaction.customId.split('.');
    if (type !== 'suggestion' || !suggestionId || !action) return;
    if (action !== 'upvote' && action !== 'downvote') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch the suggestion via service to get the messageId for embed update
    const suggestionResult = await getSuggestion(suggestionId);
    if (!suggestionResult.ok) {
      await interaction.editReply('Sugestia nie została znaleziona.');
      return;
    }
    const targetSuggestion = suggestionResult.data;

    if (!interaction.channel || !('messages' in interaction.channel)) {
      await interaction.editReply('Nie można pobrać wiadomości z tego kanału.');
      return;
    }
    const textChannel = interaction.channel as TextChannel;
    const targetMessage = await textChannel.messages.fetch(targetSuggestion.messageId);
    if (!targetMessage || targetMessage.embeds.length === 0) {
      await interaction.editReply('Wiadomość docelowa nie zawiera żadnych osadzonych treści.');
      return;
    }

    const result = await vote({
      suggestionId,
      odId: interaction.user.id,
      username: interaction.user.username,
      direction: action,
    });

    if (!result.ok) {
      await interaction.editReply(result.message);
      return;
    }

    await interaction.editReply(action === 'upvote' ? 'Oddano głos na tak!' : 'Oddano głos na nie!');

    const targetMessageEmbed = targetMessage.embeds[0];
    targetMessageEmbed.fields[1].value = formatResults(
      interaction.client.user!.id,
      result.data.upvotes,
      result.data.downvotes
    );

    await targetMessage.edit({ embeds: [targetMessageEmbed] });
  } catch (error) {
    logger.error(`Error in handleSuggestion: ${error}`);
  }
}
