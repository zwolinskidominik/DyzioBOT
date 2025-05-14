import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  ButtonInteraction,
  Message,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { QuestionModel } from '../../models/Question';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IQuestion } from '../../interfaces/Models';
import type { IEmbedData } from '../../interfaces/Embed';
import { getGuildConfig } from '../../config/guild';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';
import { chunk } from 'lodash';

export const data = new SlashCommandBuilder()
  .setName('question')
  .setDescription('Zarządzaj pytaniami dnia')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Wyświetl listę pytań w bazie danych')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Dodaj nowe pytanie')
      .addStringOption((option) =>
        option
          .setName('content')
          .setDescription('Treść pytania')
          .setRequired(true)
          .setMaxLength(1000)
      )
      .addStringOption((option) =>
        option
          .setName('reactions')
          .setDescription('Reakcje na pytanie (oddzielone spacją)')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Usuń pytanie o danym numerze')
      .addIntegerOption((option) =>
        option.setName('number').setDescription('Numer pytania do usunięcia').setRequired(true)
      )
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'list':
      await handleListSubcommand(interaction);
      break;
    case 'add':
      await handleAddSubcommand(interaction);
      break;
    case 'remove':
      await handleRemoveSubcommand(interaction);
      break;
  }
}

async function handleListSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const pageSize = 5;
    let currentPage = 1;

    const allQuestions = await QuestionModel.find().sort({ _id: 1 }).lean<IQuestion[]>();
    const totalQuestions = allQuestions.length;
    const pages = chunk(allQuestions, pageSize);
    const totalPages = pages.length || 1;

    const generateEmbed = (page: number): IEmbedData => {
      const questions = pages[page - 1] || [];
      const desc = questions
        .map((q, i: number) => {
          const question = q as IQuestion;
          return `${(page - 1) * pageSize + i + 1}. ${question.content}\nReakcje: ${question.reactions.join(' ')}`;
        })
        .join('\n\n');
      const embed = createBaseEmbed({
        title: 'Lista pytań',
        description: desc || 'Brak pytań w bazie danych.',
        footerText: `Strona ${page} z ${totalPages} | Łączna liczba pytań: ${totalQuestions}`,
      });
      return { embed, totalPages };
    };

    function generateButtons(guildId: string, currentPage: number, totalPages: number) {
      const {
        emojis: { next: NEXT, previous: PREVIOUS },
      } = getGuildConfig(guildId);
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setEmoji(PREVIOUS)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 1),
        new ButtonBuilder()
          .setCustomId('next')
          .setEmoji(NEXT)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages)
      );
    }

    const { embed } = generateEmbed(currentPage);
    const buttonRow = generateButtons(interaction.guild!.id, currentPage, totalPages);

    const reply = await interaction.editReply({ embeds: [embed], components: [buttonRow] });

    const collector = (reply as Message).createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
    });

    collector.on('collect', async (btnInteraction: ButtonInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        await btnInteraction.reply({
          content: 'Nie możesz używać tych przycisków.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await btnInteraction.deferUpdate();

      if (btnInteraction.customId === 'prev' && currentPage > 1) {
        currentPage--;
      } else if (btnInteraction.customId === 'next' && currentPage < totalPages) {
        currentPage++;
      }

      const { embed: newEmbed } = generateEmbed(currentPage);
      const newButtonRow = generateButtons(interaction.guild!.id, currentPage, totalPages);

      await btnInteraction.editReply({ embeds: [newEmbed], components: [newButtonRow] });
    });

    collector.on('end', async () => {
      try {
        const message = await interaction.channel?.messages
          .fetch((reply as Message).id)
          .catch(() => null);

        if (!message) return;

        const disabledButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          ButtonBuilder.from(buttonRow.components[0] as ButtonBuilder).setDisabled(true),
          ButtonBuilder.from(buttonRow.components[1] as ButtonBuilder).setDisabled(true)
        );

        await (reply as Message).edit({ components: [disabledButtonRow] });
      } catch (error) {}
    });
  } catch (error) {
    logger.error(`Błąd podczas listowania pytań: ${error}`);
    const errorEmbed = createBaseEmbed({
      isError: true,
      description: 'Wystąpił błąd podczas wyświetlania listy pytań.',
    });
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleAddSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const errorEmbed = createBaseEmbed({ isError: true });
  const successEmbed = createBaseEmbed();

  const question = interaction.options.getString('content')?.trim() || '';
  const reactionsInput = interaction.options.getString('reactions')?.trim() || '';

  if (question.length < 5) {
    await interaction.editReply({
      embeds: [errorEmbed.setDescription('Pytanie musi mieć co najmniej 5 znaków.')],
    });
    return;
  }

  const reactions = reactionsInput.split(/\s+/).filter(Boolean);

  if (reactions.length < 2 || reactions.length > 5) {
    await interaction.editReply({
      embeds: [errorEmbed.setDescription('Musisz podać od 2 do 5 reakcji.')],
    });
    return;
  }

  const invalidReactions = reactions.filter((r: string) => !isValidEmoji(r));
  if (invalidReactions.length > 0) {
    logger.warn(`Niepoprawne reakcje: ${invalidReactions.join(', ')} w pytaniu`);
    await interaction.editReply({
      embeds: [
        errorEmbed.setDescription(
          `Następujące reakcje są nieprawidłowe: ${invalidReactions.join(', ')}`
        ),
      ],
    });
    return;
  }

  try {
    const newQuestion = new QuestionModel({
      authorId: interaction.user.id,
      content: question,
      reactions,
    });

    await newQuestion.save();

    await interaction.editReply({
      embeds: [successEmbed.setDescription('Pomyślnie dodano pytanie dnia!')],
    });
  } catch (error: unknown) {
    logger.error(`Błąd podczas dodawania pytania: ${error}`);
    await interaction.editReply({
      embeds: [errorEmbed.setDescription(`Wystąpił błąd podczas dodawania pytania: ${error}`)],
    });
  }
}

async function handleRemoveSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const questionNumber = interaction.options.getInteger('number', true);
  const totalQuestions = await QuestionModel.countDocuments();

  if (questionNumber < 1 || questionNumber > totalQuestions) {
    const invalidEmbed = createBaseEmbed({
      isError: true,
      description: `Nieprawidłowy numer pytania. Wprowadź numer od 1 do ${totalQuestions}.`,
    });
    await interaction.reply({ embeds: [invalidEmbed], flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    const questions = await QuestionModel.find().sort({ _id: 1 });
    const questionToDelete = questions[questionNumber - 1];

    if (!questionToDelete) {
      const notFoundEmbed = createBaseEmbed({
        isError: true,
        description: `Nie znaleziono pytania o podanym numerze.`,
      });
      await interaction.reply({ embeds: [notFoundEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    await QuestionModel.findByIdAndDelete(questionToDelete._id);

    const successEmbed = createBaseEmbed({
      description: `Pytanie nr ${questionNumber} zostało pomyślnie usunięte.`,
    });

    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    logger.error(`Błąd podczas usuwania pytania: ${error}`);
    const errorEmbed = createBaseEmbed({
      isError: true,
      description: `Wystąpił błąd podczas usuwania pytania: ${error}`,
    });
    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

function isValidEmoji(reaction: string): boolean {
  const emojiRegex = /^(\p{Emoji}|\p{Emoji_Component})+$/u;
  const discordEmojiRegex = /^<a?:[a-zA-Z0-9_]+:[0-9]+>$/;
  return emojiRegex.test(reaction) || discordEmojiRegex.test(reaction);
}
