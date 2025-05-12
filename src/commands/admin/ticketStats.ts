import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { TicketStatsModel } from '../../models/TicketStats';
import type { ITicketStats } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ticket-stats')
  .setDescription(
    'Wyświetla statystyki obsługi zgłoszeń dla moderatorów, administratorów i właściciela.'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .setDMPermission(false);

export const options = {
  userPermissions: [PermissionFlagsBits.MuteMembers],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('Ta komenda działa tylko na serwerze.');
      return;
    }

    const stats = await TicketStatsModel.find({ guildId })
      .sort({ count: -1 })
      .lean<ITicketStats[]>()
      .exec();

    if (stats.length === 0) {
      await interaction.editReply({ content: 'Brak statystyk zgłoszeń na tym serwerze.' });
      return;
    }

    const description = formatStatsDescription(stats);

    const embed: EmbedBuilder = createBaseEmbed({
      title: 'Statystyki zgłoszeń',
      description,
      color: COLORS.DEFAULT,
      footerText: interaction.guild?.name,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas pobierania statystyk ticketów: ${error}`);
    await interaction.editReply('Wystąpił błąd podczas pobierania statystyk.');
  }
}

function formatStatsDescription(stats: Array<ITicketStats>): string {
  return stats
    .map(
      (stat, index) => `**${index + 1}. <@!${stat.userId}> - pomógł/pomogła ${stat.count} razy**`
    )
    .join('\n');
}
