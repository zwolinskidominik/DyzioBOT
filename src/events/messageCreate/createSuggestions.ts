import {
  Message,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import {
  isSuggestionChannel,
  createSuggestion,
  getSuggestionConfig,
  SuggestionConfigData,
} from '../../services/suggestionService';
import { formatResults, createBaseEmbed } from '../../utils/embedHelpers';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';

export default async function run(message: Message): Promise<void> {
  try {
    if (!shouldProcessMessage(message)) {
      return;
    }

    const guildId = message.guild!.id;
    const botId = message.client.user!.id;

    const isSuggestion = await isSuggestionChannel({ guildId, channelId: message.channelId });
    if (!isSuggestion) {
      return;
    }

    const configResult = await getSuggestionConfig(guildId);
    if (!configResult.ok) {
      return;
    }
    const config = configResult.data;

    const suggestionText = message.content.trim();
    if (!suggestionText) {
      return;
    }

    await message.delete().catch((error) => {
      logger.error(`Nie można usunąć wiadomości: ${error}`);
    });

    if (!('send' in message.channel)) {
      logger.error('Kanał nie obsługuje wysyłania wiadomości');
      return;
    }

    const suggestionMessage = await message.channel.send({
      content: '💡 Tworzenie sugestii, proszę czekać...',
    });

    const result = await createSuggestion({
      authorId: message.author.id,
      guildId,
      messageId: suggestionMessage.id,
      content: suggestionText,
    });

    if (!result.ok) {
      logger.error(`Failed to create suggestion: ${result.message}`);
      return;
    }

    const suggestionEmbed = createSuggestionEmbed(botId, message, suggestionText, config);
    const components = createVotingButtons(botId, result.data.suggestionId);

    await suggestionMessage.edit({
      content: '',
      embeds: [suggestionEmbed],
      components: [components],
    });

    await createDiscussionThread(suggestionMessage, suggestionText);
  } catch (error) {
    logger.error(`Błąd podczas tworzenia sugestii: ${error}`);
    try {
      if ('send' in message.channel) {
        await message.channel.send({
          content: '❌ Wystąpił błąd podczas tworzenia sugestii. Spróbuj ponownie później.',
        });
      }
    } catch {}
  }
}

function shouldProcessMessage(message: Message): boolean {
  if (message.author.bot) return false;
  
  if (message.author.id === message.client.user?.id) return false;

  if (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GroupDM) {
    return false;
  }

  if (!message.guild) return false;

  return true;
}

async function createDiscussionThread(
  startMessage: Message,
  suggestionText: string
): Promise<void> {
  const threadName =
    suggestionText.length > 97 ? `${suggestionText.slice(0, 97)}…` : suggestionText;

  try {
    await startMessage.startThread({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'Wątek dyskusyjny dla sugestii',
    });
  } catch (error) {
    logger.error(`Nie można utworzyć wątku dyskusyjnego: ${error}`);
  }
}

function createSuggestionEmbed(
  botId: string,
  message: Message,
  suggestionText: string,
  config: SuggestionConfigData
) {
  const embed = createBaseEmbed({
    color: config.embedColor,
    ...(config.anonymous
      ? {}
      : {
          authorName: message.author.username,
          authorIcon: message.author.displayAvatarURL({ size: 256 }),
        }),
    ...(config.anonymous ? { footerText: '🕵️ Zgłoszenie anonimowe' } : {}),
  }).addFields([
    { name: 'Sugestia', value: suggestionText },
    { name: 'Głosy', value: formatResults(botId, [], [], config.votingFormat) },
  ]);

  return embed;
}

function createVotingButtons(botId: string, suggestionId: string) {
  const {
    emojis: {
      suggestion: { upvote: upvoteEmoji, downvote: downvoteEmoji },
    },
  } = getBotConfig(botId);

  const upvoteButton = new ButtonBuilder()
    .setEmoji(upvoteEmoji)
    .setLabel('Za')
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`suggestion.${suggestionId}.upvote`);

  const downvoteButton = new ButtonBuilder()
    .setEmoji(downvoteEmoji)
    .setLabel('Przeciw')
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`suggestion.${suggestionId}.downvote`);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(upvoteButton, downvoteButton);
}
