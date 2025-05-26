import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  User,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { WarnModel, WarnDocument } from '../../models/Warn';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn-usun')
  .setDescription('Usuwa ostrzeżenie użytkownika o podanym identyfikatorze.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, któremu chcesz usunąć ostrzeżenie.')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('id_ostrzezenia')
      .setDescription('Identyfikator ostrzeżenia do usunięcia.')
      .setRequired(true)
  );

export const options = {
  userPermissions: PermissionFlagsBits.ModerateMembers,
  botPermissions: PermissionFlagsBits.ModerateMembers,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Ta komenda działa tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const targetUser: User | null = interaction.options.getUser('uzytkownik', true);
  const targetUserId: string = targetUser.id;
  const warningId: number = interaction.options.getInteger('id_ostrzezenia', true);
  const guildId: string = interaction.guild.id;

  if (warningId === null) {
    await interaction.editReply({ content: 'Nie podano identyfikatora ostrzeżenia.' });
    return;
  }

  try {
    const errorEmbed = createErrorEmbed('', interaction.guild.name);
    const successEmbed = createSuccessEmbed(
      warningId,
      targetUserId,
      targetUser.displayAvatarURL(),
      interaction.guild.name
    );

    const warn = (await WarnModel.findOne({
      userId: targetUserId,
      guildId,
    }).exec()) as WarnDocument | null;

    if (!warn) {
      errorEmbed.setDescription('Użytkownik nie posiada żadnych ostrzeżeń.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (warningId > warn.warnings.length || warningId < 1) {
      errorEmbed.setDescription(`Nie znaleziono ostrzeżenia o ID: ${warningId}.`);
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    warn.warnings.splice(warningId - 1, 1);
    await warn.save();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas usuwania ostrzeżenia userId=${targetUserId}: ${errorMessage}`);

    const errorEmbed = createErrorEmbed(
      'Wystąpił błąd podczas usuwania ostrzeżenia.',
      interaction.guild.name
    );
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function createSuccessEmbed(
  warningId: number,
  userId: string,
  thumbnailUrl: string | null,
  guildName: string
): EmbedBuilder {
  return createBaseEmbed({
    isError: false,
    thumbnail: thumbnailUrl || undefined,
    description: `Ostrzeżenie o ID: ${warningId} zostało usunięte dla użytkownika <@!${userId}>.`,
    footerText: guildName,
  });
}

function createErrorEmbed(description: string, guildName: string | undefined): EmbedBuilder {
  return createBaseEmbed({
    isError: true,
    description,
    footerText: guildName,
  });
}
