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

        if (action === 'approve') {
            if (!interaction.memberPermissions.has('Administrator')) {
                await interaction.editReply('Nie masz uprawnień do zaakceptowania sugestii.');
                return;
            }

            targetSuggestion.status = 'approved';

            targetMessageEmbed.data.color = 0x84e660;
            targetMessageEmbed.fields[1].value = '✅ Zatwierdzona';

            await targetSuggestion.save();

            await interaction.editReply('Sugestia zatwierdzona!');

            targetMessage.edit({
                embeds: [targetMessageEmbed],
                components: [targetMessage.components[0]],
            });

            return;
        }

        if (action === 'reject') {
            if (!interaction.memberPermissions.has('Administrator')) {
                await interaction.editReply('Nie masz uprawnień do odrzucania sugestii.');
                return;
            }

            targetSuggestion.status = 'rejected';

            targetMessageEmbed.data.color = 0xff6161;
            targetMessageEmbed.fields[1].value = '❌ Odrzucona';

            await targetSuggestion.save();

            interaction.editReply('Sugestia odrzucona!');

            targetMessage.edit({
                embeds: [targetMessageEmbed],
                components: [targetMessage.components[0]],
            });

            return;
        }

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