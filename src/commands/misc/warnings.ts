import {
  SlashCommandBuilder,
  User,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { getWarnings, GetWarningsData } from '../../services/warnService';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('Sprawdza liczbę ostrzeżeń użytkownika.')
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('nick')
      .setDescription('Użytkownik, którego liczba ostrzeżeń ma zostać sprawdzona.')
      .setRequired(false)
  );

export const options = {
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const targetUser: User = interaction.options.getUser('nick') || interaction.user;
  const userId = targetUser.id;
  const guildId = interaction.guild!.id;

  if (!hasPermissionToCheckOthers(interaction, userId)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nie masz uprawnień do sprawdzania ostrzeżeń innych użytkowników.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await getWarnings({ guildId, userId });

    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
      return;
    }

    const { warnings, count } = result.data;

    const embed = createWarningsEmbed(
      targetUser,
      count,
      warnings,
      interaction.user.tag,
      interaction.user.displayAvatarURL()
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd /warnings: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Wystąpił błąd podczas sprawdzania ostrzeżeń.')],
    });
  }
}

const WarnHelpers = {
  formatWarningList: (warnings: GetWarningsData['warnings']): string => {
    return warnings
      .map(
        (warning, index) => {
          const moderator = warning.moderatorId 
            ? `<@${warning.moderatorId}>` 
            : warning.moderator || 'Nieznany';
          return `**⏱️ ${warning.date.toLocaleString()}**\nID ostrzeżenia (**${
            index + 1
          }**) - Moderator: ${moderator}\n\`${warning.reason}\``;
        }
      )
      .join('\n\n');
  },
};

function hasPermissionToCheckOthers(
  interaction: ChatInputCommandInteraction,
  targetUserId: string
): boolean {
  if (targetUserId === interaction.user.id) return true;
  if (!interaction.member || typeof interaction.member.permissions === 'string') return false;
  return interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);
}

function createWarningsEmbed(
  targetUser: User,
  warningCount: number,
  warnings: GetWarningsData['warnings'],
  userTag: string,
  avatarURL: string
): EmbedBuilder {
  const embed = createBaseEmbed({
    color: COLORS.WARNINGS_LIST,
    title: `Liczba ostrzeżeń - ${targetUser.tag}: ${warningCount}`,
    footerText: `Na życzenie ${userTag}`,
    footerIcon: avatarURL,
  });

  if (warnings && warnings.length > 0) {
    embed.setDescription(WarnHelpers.formatWarningList(warnings));
  }

  return embed;
}
