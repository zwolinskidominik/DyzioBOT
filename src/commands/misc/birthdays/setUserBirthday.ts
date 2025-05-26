import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../../models/Birthday';
import type { IParsedDateResult } from '../../../interfaces/Birthday';
import type { ICommandOptions } from '../../../interfaces/Command';
import { getBotConfig } from '../../../config/bot';
import { COLORS } from '../../../config/constants/colors';
import { createBaseEmbed } from '../../../utils/embedHelpers';
import logger from '../../../utils/logger';

const DATE_PATTERN_WITH_YEAR = /^\d{2}-\d{2}-\d{4}$/;
const DATE_PATTERN_WITHOUT_YEAR = /^\d{2}-\d{2}$/;

export const data = new SlashCommandBuilder()
  .setName('urodziny-ustaw')
  .setDescription('Ustawia datę urodzin innego użytkownika.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego datę urodzin chcesz ustawić.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('data')
      .setDescription('Data urodzin w formacie DD-MM-YYYY lub DD-MM.')
      .setRequired(true)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const errorEmbed = createBaseEmbed({ isError: true });
  const successEmbed = createBaseEmbed({ color: COLORS.BIRTHDAY });

  const dateString = interaction.options.getString('data', true);
  const userOption = interaction.options.getUser('uzytkownik', true);
  const guildId = interaction.guild?.id;
  const botId = interaction.client.application!.id;

  if (!dateString || !userOption) {
    await replyWithError(
      interaction,
      errorEmbed,
      'Brak wymaganych argumentów. Podaj użytkownika i datę.'
    );
    return;
  }

  if (!guildId) {
    return replyWithError(interaction, errorEmbed, 'Ta komenda działa tylko na serwerze.');
  }

  const userId = userOption.id;

  if (userId === interaction.user.id) {
    await replyWithError(
      interaction,
      errorEmbed,
      'Aby ustawić urodziny dla siebie użyj komendy /urodziny-zapisz.'
    );
    return;
  }

  const { isValid, date, yearSpecified, errorMessage } = parseBirthdayDate(dateString);
  if (!isValid || !date) {
    await replyWithError(interaction, errorEmbed, errorMessage!);
    return;
  }

  try {
    await interaction.deferReply();

    await saveBirthdayToDatabase(userId, guildId, date, yearSpecified);

    const birthdayMessage = createBirthdayMessage(botId, userId, date, yearSpecified);

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
  const filter = { userId, guildId };
  const update = { date, yearSpecified };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  return BirthdayModel.findOneAndUpdate(
    filter,
    update,
    options
  ).exec() as Promise<BirthdayDocument>;
}

function createBirthdayMessage(
  botId: string,
  userId: string,
  date: Date,
  yearSpecified: boolean
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthdayDate = new Date(date);
  const nextBirthday = new Date(
    today.getFullYear(),
    birthdayDate.getMonth(),
    birthdayDate.getDate()
  );

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
    const birthYear = date.getFullYear();
    const nextAge = nextBirthday.getFullYear() - birthYear;
    ageMessage = `${nextAge}`;
  }

  const {
    emojis: { birthday: EMOJI },
  } = getBotConfig(botId);

  if (diffDays === 0) {
    return `Zanotowano, **${ageMessage}** urodziny <@!${userId}> są dziś! Wszystkiego najlepszego! ${EMOJI}`;
  } else {
    return yearSpecified
      ? `Zanotowano, **${ageMessage}** urodziny <@!${userId}> już za **${diffDays}** ${getDaysForm(diffDays)}, **${formattedDate}** 🎂.`
      : `Zanotowano, **Następne** urodziny <@!${userId}> są za **${diffDays}** ${getDaysForm(diffDays)}, **${formattedDate}** 🎂.`;
  }
}

function getDaysForm(days: number): string {
  return days === 1 ? 'dzień' : 'dni';
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
