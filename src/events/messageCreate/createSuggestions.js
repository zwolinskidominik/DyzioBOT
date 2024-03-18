const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const GuildConfiguration = require('../../models/GuildConfiguration');
const formatResults = require('../../utils/formatResults');
const Suggestion = require('../../models/Suggestion');

module.exports = async (message) => {
  if (message.author.bot || message.channel.type === ChannelType.GroupDM) return;

  const guildConfig = await GuildConfiguration.findOne({
    guildId: message.guildId,
  });

  if (!guildConfig?.suggestionChannelIds.includes(message.channelId)) return;

  try {
    const suggestionText = message.content;

    //Usuń wiadomość użytkownika
    await message.delete();

    // Utwórz sugestię i wątek.
    let suggestionMessage = await message.channel.send(
      'Tworzenie sugestii, proszę czekać...'
    );

    const newSuggestion = new Suggestion({
      authorId: message.author.id,
      guildId: message.guildId,
      messageId: suggestionMessage.id,
      content: suggestionText,
    });

    await newSuggestion.save();

    await message.channel.threads.create({
      name: `${suggestionText}`,
      autoArchiveDuration: 60,
      type: ChannelType.PublicThread,
      startMessage: suggestionMessage,
    });

    // Tworzenie embeda sugestii oraz przycisków
    const suggestionEmbed = new EmbedBuilder()
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ size: 256 }),
      })
      .addFields([
        { name: 'Sugestia', value: suggestionText },
        { name: 'Głosy', value: formatResults() },
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
    const firstRow = new ActionRowBuilder().addComponents(
      upvoteButton,
      downvoteButton
    );

    // Aktualizacja embeda sugestii
    suggestionMessage.edit({
      content: '',
      embeds: [suggestionEmbed], // ...
      components: [firstRow], // ...
    });

  } catch (error) {
    console.error('Błąd podczas tworzenia sugestii:', error);
    message.channel.send(
      'Wystąpił błąd podczas tworzenia sugestii.'
    );
  }
};
