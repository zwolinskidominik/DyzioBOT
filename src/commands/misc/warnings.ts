import {
  SlashCommandBuilder,
  User,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { WarnModel } from '../../models/Warn';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IWarnDocument } from '../../interfaces/Models';
import { createBaseEmbed } from '../../utils/embedHelpers';
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

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Ta komenda działa tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser: User = interaction.options.getUser('nick') || interaction.user;
  const userId = targetUser.id;
  const guildId = interaction.guild.id;

  if (!hasPermissionToCheckOthers(interaction, userId)) {
    await interaction.reply({
      content: 'Nie masz uprawnień do sprawdzania ostrzeżeń innych użytkowników.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const warn = await WarnModel.findOne({ userId, guildId }).lean<IWarnDocument>().exec();

    const warnings = warn?.warnings ?? [];
    const count = warnings.length;

    const embed = createWarningsEmbed(
      targetUser,
      count,
      warnings,
      interaction.user.tag,
      interaction.user.displayAvatarURL()
    );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error(`Błąd /warnings: ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas sprawdzania ostrzeżeń.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

const WarnHelpers = {
  formatWarningList: (warnings: IWarnDocument['warnings']): string => {
    return warnings
      .map(
        (warning, index) =>
          `**⏱️ ${warning.date.toLocaleString()}**\nID ostrzeżenia (**${
            index + 1
          }**) - Moderator: ${warning.moderator}\n\`${warning.reason}\``
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
  warnings: IWarnDocument['warnings'],
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
