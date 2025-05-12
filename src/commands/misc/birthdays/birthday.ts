import {
  SlashCommandBuilder,
  User,
  EmbedBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../../models/Birthday';
import type { IBirthday } from '../../../interfaces/Models';
import type { ICommandOptions } from '../../../interfaces/Command';
import { getGuildConfig } from '../../../config/guild';
import { COLORS } from '../../../config/constants/colors';
import { createBaseEmbed } from '../../../utils/embedHelpers';
import logger from '../../../utils/logger';

const REMEMBER_BIRTHDAY_COMMAND_ID = '1244599618617081864';
const SET_USER_BIRTHDAY_COMMAND_ID = '1244599618747109506';

export const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Wyświetla Twoją datę urodzin lub datę urodzin innego użytkownika.')
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('target-user')
      .setDescription('Użytkownik, którego datę urodzin chcesz sprawdzić.')
      .setRequired(false)
  );

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const errorEmbed = createBaseEmbed({ isError: true });
  const successEmbed = createBaseEmbed({ color: COLORS.BIRTHDAY });
  const targetUser = interaction.options.getUser('target-user') || interaction.user;
  const userId = targetUser.id;
  const guildId = interaction.guild?.id;

  if (!guildId) {
    await replyWithGuildOnlyError(interaction, errorEmbed);
    return;
  }

  try {
    await interaction.deferReply();
    const birthday = await getBirthdayInfo(userId, guildId);

    if (!birthday) {
      await replyWithNoBirthdayInfo(interaction, errorEmbed, targetUser);
      return;
    }

    const birthdayMessage = createBirthdayMessage(guildId, birthday, targetUser);
    await interaction.editReply({ embeds: [successEmbed.setDescription(birthdayMessage)] });
  } catch (error) {
    await handleError(interaction, errorEmbed, userId, error);
  }
}

function createBirthdayMessage(guildId: string, birthday: IBirthday, targetUser: User) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthdayDate = new Date(birthday.date);
  const yearSpecified = birthday.yearSpecified;

  let age = yearSpecified ? today.getFullYear() - birthdayDate.getFullYear() : null;

  const nextBirthday = new Date(
    today.getFullYear(),
    birthdayDate.getMonth(),
    birthdayDate.getDate()
  );

  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
    if (yearSpecified && age !== null) {
      age += 1;
    }
  }

  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcNextBirthday = Date.UTC(
    nextBirthday.getFullYear(),
    nextBirthday.getMonth(),
    nextBirthday.getDate()
  );

  const diffTime = utcNextBirthday - utcToday;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const fullDate = nextBirthday.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const {
    emojis: { birthday: EMOJI },
  } = getGuildConfig(guildId);

  if (diffDays === 0) {
    return yearSpecified && age !== null
      ? `**${age}** urodziny ${targetUser} są dziś! Wszystkiego najlepszego! ${EMOJI}`
      : `Urodziny ${targetUser} są dziś! Wszystkiego najlepszego! ${EMOJI}`;
  } else {
    return yearSpecified && age !== null
      ? `**${age}** urodziny ${targetUser} są za **${diffDays}** ${getDaysForm(diffDays)}, **${fullDate}** 🎂`
      : `**Następne** urodziny ${targetUser} są za **${diffDays}** ${getDaysForm(diffDays)}, **${fullDate}** 🎂`;
  }
}

async function getBirthdayInfo(userId: string, guildId: string): Promise<BirthdayDocument | null> {
  return await BirthdayModel.findOne({ userId, guildId }).exec();
}

function getDaysForm(days: number): string {
  if (days === 1) return 'dzień';
  return 'dni';
}

async function replyWithGuildOnlyError(
  interaction: ChatInputCommandInteraction,
  errorEmbed: EmbedBuilder
): Promise<void> {
  await interaction.reply({
    embeds: [errorEmbed.setDescription('Ta komenda działa tylko na serwerze.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function replyWithNoBirthdayInfo(
  interaction: ChatInputCommandInteraction,
  errorEmbed: EmbedBuilder,
  targetUser: User
): Promise<void> {
  await interaction.editReply({
    embeds: [
      errorEmbed
        .setDescription(
          `Nie znam **jeszcze** daty urodzin ${targetUser}.\n\nUżyj </remember-birthday:${REMEMBER_BIRTHDAY_COMMAND_ID}> lub </set-user-birthday:${SET_USER_BIRTHDAY_COMMAND_ID}>, aby ustawić datę urodzin.`
        )
        .addFields({
          name: 'Przykłady:',
          value:
            `- </remember-birthday:${REMEMBER_BIRTHDAY_COMMAND_ID}> 15-04\n` +
            `- </remember-birthday:${REMEMBER_BIRTHDAY_COMMAND_ID}> 13-09-2004\n` +
            `- </set-user-birthday:${SET_USER_BIRTHDAY_COMMAND_ID}> 15-04-1994 \`@Dyzio\``,
        }),
    ],
  });
}

async function handleError(
  interaction: ChatInputCommandInteraction,
  errorEmbed: EmbedBuilder,
  userId: string,
  error: unknown
): Promise<void> {
  logger.error(`Błąd podczas sprawdzania daty urodzin userId=${userId}: ${error}`);
  await interaction.editReply({
    embeds: [errorEmbed.setDescription('Wystąpił błąd podczas sprawdzania daty urodzin.')],
  });
}
