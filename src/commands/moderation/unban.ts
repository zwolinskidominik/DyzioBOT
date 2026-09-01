import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, Guild } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  findBannedUser,
} from '../../utils/moderationHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { markBanLogUndone } from '../../services/moderationLogService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Odbanuj użytkownika z serwera')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName('id_uzytkownika')
      .setDescription('ID użytkownika, którego chcesz odbanować.')
      .setRequired(true)
  );

export const options = {
  // userPermissions celowo pominięte — dostęp sprawdzamy ręcznie przez checkCommandAccess()
  // (extraRoleIds z ModerationConfig ma prawo przepuścić moderatora bez natywnego uprawnienia).
  botPermissions: [PermissionFlagsBits.BanMembers],
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
      commandKey: 'unban',
      requiredPermission: PermissionFlagsBits.BanMembers,
    });
    if (!access.allowed) {
      await interaction.editReply({ embeds: [errorEmbed.setDescription(`**${access.reason}**`)] });
      return;
    }
    const { config } = access;

    const targetUserId = interaction.options.getString('id_uzytkownika', true);

    const bannedUser = await findBannedUser(guild, targetUserId);
    if (!bannedUser) {
      errorEmbed.setDescription('**Nie znaleziono użytkownika na liście banów.**');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    await guild.bans.remove(targetUserId);

    if (config.unban.log) {
      await markBanLogUndone(guild.id, targetUserId);
    }

    if (config.unban.dm) {
      try {
        await bannedUser.send({
          embeds: [createBaseEmbed({
            title: '✅ Zostałeś odbanowany',
            description:
              `**Serwer:** ${guild.name}\n` +
              `**Moderator:** <@${interaction.user.id}>`,
            color: COLORS.JOIN,
          })],
        });
      } catch {
        logger.debug(`Nie można wysłać DM do ${bannedUser.tag}`);
      }
    }

    const successEmbed = createModSuccessEmbed(
      'unban',
      bannedUser,
      interaction.user,
      interaction.guild!.iconURL(),
      interaction.guild!.name
    );

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas próby odbanowania użytkownika: ${error}`);
    await interaction.editReply({
      embeds: [
        errorEmbed.setDescription('**Wystąpił błąd podczas odbanowywania użytkownika.**'),
      ],
    });
  }
}
