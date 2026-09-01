import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  User,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { removeWarn } from '../../services/warnService';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { markWarnLogUndone } from '../../services/moderationLogService';
import { sendLog, moderatorField } from '../../utils/logHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn-remove')
  .setDescription('Usuń wybrane ostrzeżenie użytkownika')
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
  // userPermissions celowo pominięte — dostęp sprawdzamy ręcznie przez checkCommandAccess()
  // (extraRoleIds z ModerationConfig ma prawo przepuścić moderatora bez natywnego uprawnienia).
  botPermissions: PermissionFlagsBits.ModerateMembers,
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const targetUser: User | null = interaction.options.getUser('uzytkownik', true);
  const targetUserId: string = targetUser.id;
  const warningId: number = interaction.options.getInteger('id_ostrzezenia', true);
  const guildId: string = interaction.guild!.id;

  await interaction.deferReply();

  try {
    const access = await checkCommandAccess({
      guildId,
      member: interaction.member as GuildMember,
      commandKey: 'warnRemove',
      requiredPermission: PermissionFlagsBits.ModerateMembers,
    });
    if (!access.allowed) {
      await interaction.editReply({ embeds: [createErrorEmbed(access.reason ?? 'Brak uprawnień.')] });
      return;
    }

    const result = await removeWarn({
      guildId: guildId,
      userId: targetUserId,
      warningIndex: warningId,
    });

    if (!result.ok) {
      await interaction.editReply({
        embeds: [createErrorEmbed(result.message)],
      });
      return;
    }

    if (result.data.removedId) {
      await markWarnLogUndone(guildId, result.data.removedId);
    }

    const successEmbed = createSuccessEmbed(
      warningId,
      targetUserId,
      targetUser.displayAvatarURL(),
      interaction.guild!.name
    );

    await interaction.editReply({ embeds: [successEmbed] });

    await sendLog(interaction.client, interaction.guild!.id, 'moderationCommand', {
      title: null,
      description: `**⚖️ Użyto komendy \`/warn-remove\` wobec <@${targetUserId}>.**`,
      fields: [
        { name: 'ID ostrzeżenia', value: String(warningId), inline: true },
        moderatorField(interaction.user.id),
      ],
      authorName: targetUser.tag,
      authorIcon: targetUser.displayAvatarURL({ size: 64 }),
    }, { userId: targetUserId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas usuwania ostrzeżenia userId=${targetUserId}: ${errorMessage}`);

    const catchErrorEmbed = createErrorEmbed(
      'Wystąpił błąd podczas usuwania ostrzeżenia.'
    );
    
    await interaction.editReply({ embeds: [catchErrorEmbed] });
  }
}

function createSuccessEmbed(
  warningId: number,
  userId: string,
  avatarUrl: string | null,
  guildName: string
): EmbedBuilder {
  const embed = createBaseEmbed({
    isError: false,
    description: `Ostrzeżenie o ID: ${warningId} zostało usunięte dla użytkownika <@!${userId}>.`,
    footerText: guildName,
  });
  
  if (avatarUrl) {
    embed.setAuthor({ name: 'Ostrzeżenie usunięte', iconURL: avatarUrl });
  }
  
  return embed;
}
