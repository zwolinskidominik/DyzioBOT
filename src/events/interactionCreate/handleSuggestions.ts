import { ButtonInteraction, TextChannel, MessageFlags } from 'discord.js';
import { SuggestionModel } from '../../models/Suggestion';
import { formatResults } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export default async function run(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.isButton() || !interaction.customId) return;

  try {
    const [type, suggestionId, action] = interaction.customId.split('.');
    if (type !== 'suggestion' || !suggestionId || !action) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetSuggestion = await SuggestionModel.findOne({ suggestionId });
    if (!targetSuggestion) {
      await interaction.editReply('Sugestia nie została znaleziona.');
      return;
    }

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

    const targetMessageEmbed = targetMessage.embeds[0];

    const alreadyVoted =
      targetSuggestion.upvotes.includes(interaction.user.id) ||
      targetSuggestion.downvotes.includes(interaction.user.id);

    if (alreadyVoted) {
      await interaction.editReply('Oddano już głos na tę sugestię.');
      return;
    }

    if (action === 'upvote') {
      targetSuggestion.upvotes.push(interaction.user.id);
      targetSuggestion.upvoteUsernames.push(interaction.user.username);
      await interaction.editReply('Oddano głos na tak!');
    } else if (action === 'downvote') {
      targetSuggestion.downvotes.push(interaction.user.id);
      targetSuggestion.downvoteUsernames.push(interaction.user.username);
      await interaction.editReply('Oddano głos na nie!');
    }

    await targetSuggestion.save();

    targetMessageEmbed.fields[1].value = formatResults(
      interaction.guild!.id,
      targetSuggestion.upvotes,
      targetSuggestion.downvotes
    );

    await targetMessage.edit({ embeds: [targetMessageEmbed] });
  } catch (error) {
    logger.error(`Error in handleSuggestion: ${error}`);
  }
}
