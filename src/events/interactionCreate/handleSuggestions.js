const { Interaction } = require('discord.js');
const Suggestion = require('../../models/Suggestion');
const formatResults = require('../../utils/formatResults');

/**
 * 
 * @param {Interaction} interaction 
 */

module.exports = async (interaction) => {
    if (!interaction.isButton() || !interaction.customId) return;

    try {
        const [type, suggestionId, action] = interaction.customId.split('.');

        if (!type || !suggestionId || !action) return;
        if (type !== 'suggestion') return;

        await interaction.deferReply({ ephemeral: true });

        const targetSuggestion = await Suggestion.findOne({ suggestionId });
        const targetMessage = await interaction.channel.messages.fetch(targetSuggestion.messageId);
        const targetMessageEmbed = targetMessage.embeds[0];

        if (action === 'upvote') {
            const hasVoted = targetSuggestion.upvotes.includes(interaction.user.id) || targetSuggestion.downvotes.includes(interaction.user.id);

            if (hasVoted) {
                await interaction.editReply('Oddano już głos na tę sugestię.');
                return;
            }

            targetSuggestion.upvotes.push(interaction.user.id);

            await targetSuggestion.save();

            interaction.editReply('Oddano głos na tak!');

            targetMessageEmbed.fields[2].value = formatResults(
                targetSuggestion.upvotes, 
                targetSuggestion.downvotes,
            );

            targetMessage.edit({
                embeds: [targetMessageEmbed],
            });

            return;
        }

        if (action === 'downvote') {
            const hasVoted = targetSuggestion.downvotes.includes(interaction.user.id) || targetSuggestion.downvotes.includes(interaction.user.id);

            if (hasVoted) {
                await interaction.editReply('Oddano już głos na tę sugestię.');
                return;
            }

            targetSuggestion.downvotes.push(interaction.user.id);

            await targetSuggestion.save();

            interaction.editReply('Oddano głos na nie!');

            targetMessageEmbed.fields[2].value = formatResults(
                targetSuggestion.upvotes, 
                targetSuggestion.downvotes,
            );

            targetMessage.edit({
                embeds: [targetMessageEmbed],
            });

            return;
        }
    } catch (error) {
        console.log(`Error in handleSuggestion.js: ${error}`)
    }
}