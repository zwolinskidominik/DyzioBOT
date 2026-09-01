import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  Guild,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  getModFailMessage,
} from '../../utils/moderationHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { logModerationAction } from '../../services/moderationLogService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Wyrzuć użytkownika z serwera')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego chcesz wyrzucić.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('powod').setDescription('Powód wyrzucenia.').setRequired(true)
  );

export const options = {
  // userPermissions celowo pominięte — dostęp sprawdzamy ręcznie przez checkCommandAccess()
  // (extraRoleIds z ModerationConfig ma prawo przepuścić moderatora bez natywnego uprawnienia).
  botPermissions: PermissionFlagsBits.KickMembers,
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const guild: Guild = interaction.guild!;
  const errorEmbed = createModErrorEmbed('', guild.name);
  try {
    await interaction.deferReply();

    const access = await checkCommandAccess({
      guildId: guild.id,
      member: interaction.member as GuildMember,
      commandKey: 'kick',
      requiredPermission: PermissionFlagsBits.KickMembers,
    });
    if (!access.allowed) {
      await interaction.editReply({ embeds: [errorEmbed.setDescription(`**${access.reason}**`)] });
      return;
    }
    const { config } = access;

    const targetUser = interaction.options.getUser('uzytkownik');
    if (!targetUser) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('**Nie znaleziono użytkownika.**')],
      });
      return;
    }
    const targetUserId = targetUser.id;

    const reason = interaction.options.getString('powod');
    if (!reason) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('**Nie podano powodu.**')],
      });
      return;
    }

    let targetMember: GuildMember;
    try {
      targetMember = await guild.members.fetch(targetUserId);
    } catch {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('**Nie można znaleźć użytkownika na serwerze.**')],
      });
      return;
    }

    if (!guild.members.me) {
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription('**Wystąpił błąd podczas sprawdzania uprawnień bota.**'),
        ],
      });
      return;
    }

    const failMessage = getModFailMessage(targetMember, interaction.member as GuildMember, guild.members.me, 'kick');
    if (failMessage) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(`**${failMessage}**`)],
      });
      return;
    }

    if (config.kick.dm) {
      try {
        await targetUser.send({
          embeds: [createBaseEmbed({
            title: '👢 Zostałeś wyrzucony',
            description:
              `**Serwer:** ${guild.name}\n` +
              `**Powód:** ${reason}\n` +
              `**Moderator:** <@${interaction.user.id}>`,
            color: COLORS.ERROR,
          })],
        });
      } catch {
        logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
      }
    }

    await targetMember.kick(reason);

    if (config.kick.log) {
      await logModerationAction({
        guildId: guild.id,
        kind: 'kick',
        targetId: targetUserId,
        targetTag: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
      });
    }

    const successEmbed = createModSuccessEmbed(
      'kick',
      targetUser,
      interaction.user,
      interaction.guild!.iconURL(),
      interaction.guild!.name,
      reason
    );

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas wyrzucenia użytkownika: ${error}`);
    await interaction.editReply({
      embeds: [
        errorEmbed.setDescription('**Wystąpił błąd podczas próby wyrzucenia użytkownika.**'),
      ],
    });
  }
}
