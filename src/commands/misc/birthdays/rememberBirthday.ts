import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../../models/Birthday';
import type { IBirthday } from '../../../interfaces/Models';
import type { IParsedDateResult } from '../../../interfaces/Birthday';
import type { ICommandOptions } from '../../../interfaces/Command';
import { getBotConfig } from '../../../config/bot';
import { COLORS } from '../../../config/constants/colors';
import { createBaseEmbed } from '../../../utils/embedHelpers';
import logger from '../../../utils/logger';

const DATE_PATTERN_WITH_YEAR = /^\d{2}-\d{2}-\d{4}$/;
const DATE_PATTERN_WITHOUT_YEAR = /^\d{2}-\d{2}$/;

export const data = new SlashCommandBuilder()
  .setName('urodziny-zapisz')
  .setDescription('Ustawia datę urodzin użytkownika.')
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName('data')
      .setDescription('Data urodzin w formacie DD-MM-YYYY lub DD-MM.')
      .setRequired(true)
  );

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const errorEmbed = createBaseEmbed({ isError: true });
  const successEmbed = createBaseEmbed({ color: COLORS.BIRTHDAY });

  const dateString = interaction.options.getString('data', true);
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const botId = interaction.client.application!.id;

  if (!guildId) {
    await replyWithError(interaction, errorEmbed, 'Ta komenda działa tylko na serwerze.');
    return;
  }

  const parsedDate = parseBirthdayDate(dateString);
  if (!parsedDate.isValid || parsedDate.date === null) {
    await replyWithError(interaction, errorEmbed, parsedDate.errorMessage || 'Niepoprawna data.');
    return;
  }

  try {
    await interaction.deferReply();

    await saveBirthdayToDatabase(userId, guildId, parsedDate.date, parsedDate.yearSpecified);

    const birthdayMessage = createBirthdayMessage(
      botId,
      userId,
      parsedDate.date,
      parsedDate.yearSpecified
    );

    await interaction.editReply({
      embeds: [successEmbed.setDescription(birthdayMessage)],
    });
  } catch (error) {
    await handleError(interaction, errorEmbed, userId, error);
  }
}

function parseBirthdayDate(dateString: string): IParsedDateResult {
  let date: Date;
  let yearSpecified = true;

  if (DATE_PATTERN_WITH_YEAR.test(dateString)) {
    const [day, month, year] = dateString.split('-');
    date = new Date(`${year}-${month}-${day}`);
  } else if (DATE_PATTERN_WITHOUT_YEAR.test(dateString)) {
    const [day, month] = dateString.split('-');
    date = new Date(`1970-${month}-${day}`);
    yearSpecified = false;
  } else {
    return {
      isValid: false,
      date: null,
      yearSpecified: false,
      errorMessage: 'Niepoprawny format daty. Użyj formatu `DD-MM-YYYY` lub `DD-MM`.',
    };
  }

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      date: null,
      yearSpecified: false,
      errorMessage: 'Niepoprawna data. Użyj prawidłowej daty w formacie `DD-MM-YYYY` lub `DD-MM`.',
    };
  }

  return { isValid: true, date, yearSpecified };
}

async function saveBirthdayToDatabase(
  userId: string,
  guildId: string,
  date: Date,
  yearSpecified: boolean
): Promise<BirthdayDocument> {
  const filter: Partial<IBirthday> = { userId, guildId };
  const update: Partial<IBirthday> = { date, yearSpecified };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  return (await BirthdayModel.findOneAndUpdate(filter, update, options).exec()) as BirthdayDocument;
}

function createBirthdayMessage(
  botId: string,
  userId: string,
  date: Date,
  yearSpecified: boolean
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextBirthday = new Date(today.getFullYear(), date.getMonth(), date.getDate());

  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcNextBirthday = Date.UTC(
    nextBirthday.getFullYear(),
    nextBirthday.getMonth(),
    nextBirthday.getDate()
  );

  const diffTime = utcNextBirthday - utcToday;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = nextBirthday.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  let ageMessage = 'kolejne';
  if (yearSpecified) {
    ageMessage = `${nextBirthday.getFullYear() - date.getFullYear()}`;
  }

  const {
    emojis: { birthday: EMOJI },
  } = getBotConfig(botId);

  return diffDays === 0
    ? `Zanotowano, **${ageMessage}** urodziny <@!${userId}> są dziś! Wszystkiego najlepszego! ${EMOJI}`
    : `Zanotowano, **${ageMessage}** urodziny <@!${userId}> już za **${diffDays}** ${getDaysForm(diffDays)}, **${formattedDate}** 🎂.`;
}

function getDaysForm(days: number): string {
  if (days === 1) return 'dzień';
  return 'dni';
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  errorEmbed: EmbedBuilder,
  message: string
): Promise<void> {
  await interaction.reply({
    embeds: [errorEmbed.setDescription(message)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleError(
  interaction: ChatInputCommandInteraction,
  errorEmbed: EmbedBuilder,
  userId: string,
  error: unknown
): Promise<void> {
  logger.error(`Błąd podczas zapisywania daty urodzin (userId=${userId}): ${error}`);
  await interaction.editReply({
    embeds: [errorEmbed.setDescription('Wystąpił błąd podczas zapisywania daty urodzin.')],
  });
}
