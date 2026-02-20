import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommandOptions } from '../../../interfaces/Command';
import { setBirthday, formatBirthdayConfirmation } from '../../../services/birthdayService';
import { getBotConfig } from '../../../config/bot';
import { COLORS } from '../../../config/constants/colors';
import { createBaseEmbed } from '../../../utils/embedHelpers';
import logger from '../../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('birthday-set-user')
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
      'Aby ustawić urodziny dla siebie użyj komendy /birthday-remember.'
    );
    return;
  }

  try {
    await interaction.deferReply();

    const result = await setBirthday({ guildId, userId, dateString });

    if (!result.ok) {
      await replyWithError(interaction, errorEmbed, result.message);
      return;
    }

    const { date, yearSpecified } = result.data;
    const { emojis: { birthday: EMOJI } } = getBotConfig(botId);
    const birthdayMessage = formatBirthdayConfirmation(EMOJI, userId, date, yearSpecified);

    await interaction.editReply({
      embeds: [successEmbed.setDescription(birthdayMessage)],
    });
  } catch (error) {
    await handleError(interaction, errorEmbed, userId, error);
  }
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
