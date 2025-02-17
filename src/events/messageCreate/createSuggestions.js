const {
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const SuggestionConfiguration = require("../../models/SuggestionConfiguration");
const Suggestion = require("../../models/Suggestion");
const formatResults = require("../../utils/formatResults");
const logger = require("../../utils/logger");
const { createBaseEmbed } = require("../../utils/embedUtils");

module.exports = async (message) => {
  const guildId = message.guild.id;

  if (
    message.author.bot ||
    message.channel.type === ChannelType.GroupDM ||
    message.channel.type === ChannelType.DM
  ) {
    return;
  }

  try {
    const suggestionConfig = await SuggestionConfiguration.findOne({ guildId });
    if (
      !suggestionConfig ||
      suggestionConfig.suggestionChannelId !== message.channelId
    ) {
      return;
    }

    const suggestionText = message.content;
    await message.delete();

    const suggestionMessage = await message.channel.send(
      "Tworzenie sugestii, proszę czekać..."
    );

    const newSuggestion = new Suggestion({
      authorId: message.author.id,
      guildId,
      messageId: suggestionMessage.id,
      content: suggestionText,
    });
    await newSuggestion.save();

    let threadName =
      suggestionText.length > 100
        ? suggestionText.slice(0, 97) + "..."
        : suggestionText;

    await message.channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      type: ChannelType.PublicThread,
      startMessage: suggestionMessage,
    });

    const suggestionEmbed = createBaseEmbed({
      color: "#2B2D31",
      authorName: message.author.username,
      authorIcon: message.author.displayAvatarURL({ size: 256 }),
    }).addFields([
      { name: "Sugestia", value: suggestionText },
      { name: "Głosy", value: formatResults() },
    ]);

    const upvoteButton = new ButtonBuilder()
      .setEmoji("<:yes:1341047246120026254>")
      .setLabel("Za")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`suggestion.${newSuggestion.suggestionId}.upvote`);

    const downvoteButton = new ButtonBuilder()
      .setEmoji("<:no:1341047256387682456>")
      .setLabel("Przeciw")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`suggestion.${newSuggestion.suggestionId}.downvote`);

    const firstRow = new ActionRowBuilder().addComponents(
      upvoteButton,
      downvoteButton
    );

    await suggestionMessage.edit({
      content: "",
      embeds: [suggestionEmbed],
      components: [firstRow],
    });
  } catch (error) {
    logger.error(`Błąd podczas tworzenia sugestii: ${error}`);
    message.channel.send("Wystąpił błąd podczas tworzenia sugestii.");
  }
};
