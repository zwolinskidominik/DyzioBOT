import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  Guild,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  checkModPermissions,
} from '../../utils/moderationHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Wyrzuca użytkownika z serwera.')
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
  userPermissions: PermissionFlagsBits.KickMembers,
  botPermissions: PermissionFlagsBits.KickMembers,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Ta komenda działa tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild: Guild = interaction.guild;
  const errorEmbed = createModErrorEmbed('', guild.name);
  try {
    await interaction.deferReply();

    const targetUser =
      interaction.options.getUser('użytkownik') || interaction.options.getUser('uzytkownik');
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

    if (!checkModPermissions(targetMember, interaction.member as GuildMember, guild.members.me)) {
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            '**Nie możesz wyrzucić tego użytkownika z wyższą lub równą rolą.**'
          ),
        ],
      });
      return;
    }

    await targetMember.kick(reason);

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
