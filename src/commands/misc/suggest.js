const { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const GuildConfiguration = require('../../models/GuildConfiguration');
const Suggestion = require('../../models/Suggestion');
const formatResults = require('../../utils/formatResults');

module.exports = {
    data: {
        name: 'sugestia',
        description: 'Utwórz sugestię.',
        dm_permission: false,
    },

    /**
     * 
     * @param {Object} param0
     * @param {ChatInputCommandInteraction} param0.interaction
     */

    run: async ({ interaction }) => {
        try {
            const guildConfiguration = await GuildConfiguration.findOne({
                guildId: interaction.guildId
            });
    
            if (!guildConfiguration?.suggestionChannelIds.length) {
                await interaction.reply('Ten serwer nie został jeszcze skonfigurowany, aby używać sugestii.\nPoproś administratora o uruchomienie komendy `/config-suggestions add`, aby je skonfigurować.');
                return;
            }
    
            if (!guildConfiguration.suggestionChannelIds.includes(interaction.channelId)) {
                await interaction.reply(`Ta komenda jest dostępna tylko na kanałach sugestii. Spróbuj jednego z tych kanałów: ${guildConfiguration.suggestionChannelIds
                    .map((id) => `<#${id}>`)
                    .join(', ')}`
                );
                return;
            }
    
            const modal = new ModalBuilder()
                .setTitle('Utwórz sugestię')
                .setCustomId(`suggestion-${interaction.user.id}`);
    
            const textInput = new TextInputBuilder()
                .setCustomId('suggestion-input')
                .setLabel('Zaproponuj swój pomysł:')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);
    
            const actionRow = new ActionRowBuilder().addComponents(textInput);

            modal.addComponents(actionRow);
    
            await interaction.showModal(modal);
    
            const filter = (i) => i.customId === `suggestion-${interaction.user.id}`;
    
            const modalInteraction = await interaction.awaitModalSubmit({
                filter,
                time: 1000 * 60 * 3
            }).catch((error) => console.log(error));
    
            await modalInteraction.deferReply({
                ephemeral: true
            });
    
            let suggestionMessage;
    
            try {
                suggestionMessage = await interaction.channel.send('Tworzenie sugestii, proszę czekać...');
            } catch (error) {
                modalInteraction.editReply('Wystąpił błąd podczas tworzenia sugestii na tym kanale. Być może nie posiadam wystarczających uprawnień.');
                return;
            }
    
            const suggestionText = modalInteraction.fields.getTextInputValue('suggestion-input');
    
            const newSuggestion = new Suggestion({
                authorId: interaction.user.id,
                guildId: interaction.guildId,
                messageId: suggestionMessage.id,
                content: suggestionText,
            });
    
            await newSuggestion.save();
    
            modalInteraction.editReply('Sugestia utworzona!');

            await interaction.channel.threads.create({
                name: `${suggestionText}`,
                autoArchiveDuration: 60,
                startMessage: suggestionMessage,
            });
    
            //Suggestion embed
            const suggestionEmbed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL({ size: 256 }),
                })
                .addFields([
                    { name: 'Sugestia', value: suggestionText},
                    { name: 'Głosy', value: formatResults() }
                ])
                .setColor('#2B2D31');
    
                // Buttons
            const upvoteButton = new ButtonBuilder()
                .setEmoji('<:pingu_yes:1162408115677958184>')
                .setLabel('Za')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`suggestion.${newSuggestion.suggestionId}.upvote`);
    
            const downvoteButton = new ButtonBuilder()
                .setEmoji('<:pingu_no:1162408119196995696>')
                .setLabel('Przeciw')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`suggestion.${newSuggestion.suggestionId}.downvote`);
    
            // Rows
            const firstRow = new ActionRowBuilder().addComponents(upvoteButton, downvoteButton);
    
            suggestionMessage.edit({
                content: ``,
                embeds: [suggestionEmbed],
                components: [firstRow],
            });

        } catch (error) {
            console.log(`Error in /suggest: ${error}`);
        }
    },
}