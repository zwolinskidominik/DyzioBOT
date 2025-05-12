import {
  Message,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { SuggestionConfigurationModel } from '../../models/SuggestionConfiguration';
import { SuggestionModel } from '../../models/Suggestion';
import type { ISuggestion } from '../../interfaces/Models';
import { formatResults, createBaseEmbed } from '../../utils/embedHelpers';
import { getGuildConfig } from '../../config/guild';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export default async function run(message: Message): Promise<void> {
  try {
    if (!shouldProcessMessage(message)) return;

    const guildId = message.guild!.id;

    const suggestionConfig = await SuggestionConfigurationModel.findOne({ guildId });
    if (!suggestionConfig || suggestionConfig.suggestionChannelId !== message.channelId) {
      return;
    }

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

    const newSuggestion = await createSuggestionRecord(
      message.author.id,
      guildId,
      suggestionMessage.id,
      suggestionText
    );

    await createDiscussionThread(message.channel as TextChannel, suggestionMessage, suggestionText);

    const suggestionEmbed = createSuggestionEmbed(guildId, message, suggestionText);
    const components = createVotingButtons(guildId, newSuggestion.suggestionId);

    await suggestionMessage.edit({
      content: '',
      embeds: [suggestionEmbed],
      components: [components],
    });
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

  if (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GroupDM) {
    return false;
  }

  if (!message.guild) return false;

  return true;
}

async function createSuggestionRecord(
  authorId: string,
  guildId: string,
  messageId: string,
  content: string
): Promise<ISuggestion> {
  const doc = await SuggestionModel.create({
    authorId,
    guildId,
    messageId,
    content,
  });
  return doc.toObject();
}

async function createDiscussionThread(
  channel: TextChannel,
  startMessage: Message,
  suggestionText: string
): Promise<void> {
  const threadName =
    suggestionText.length > 97 ? `${suggestionText.slice(0, 97)}…` : suggestionText;

  try {
    await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      startMessage,
      reason: 'Wątek dyskusyjny dla sugestii',
    });
  } catch (error) {
    logger.error(`Nie można utworzyć wątku dyskusyjnego: ${error}`);
  }
}

function createSuggestionEmbed(guildId: string, message: Message, suggestionText: string) {
  return createBaseEmbed({
    color: COLORS.DEFAULT,
    authorName: message.author.username,
    authorIcon: message.author.displayAvatarURL({ size: 256 }),
  }).addFields([
    { name: 'Sugestia', value: suggestionText },
    { name: 'Głosy', value: formatResults(guildId) },
  ]);
}

function createVotingButtons(guildId: string, suggestionId: string) {
  const {
    emojis: {
      suggestion: { upvote: upvoteEmoji, downvote: downvoteEmoji },
    },
  } = getGuildConfig(guildId);

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
