import { SlashCommandBuilder, PermissionFlagsBits, Guild } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  findBannedUser,
} from '../../utils/moderationHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Odbanowuje użytkownika na serwerze.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName('id_uzytkownika')
      .setDescription('ID użytkownika, którego chcesz odbanować.')
      .setRequired(true)
  );

export const options = {
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const guild: Guild = interaction.guild!;
  const errorEmbed = createModErrorEmbed('', guild.name);

  try {
    await interaction.deferReply();

    const targetUserId = interaction.options.getString('id_uzytkownika', true);

    const bannedUser = await findBannedUser(guild, targetUserId);
    if (!bannedUser) {
      errorEmbed.setDescription('**Nie znaleziono użytkownika na liście banów.**');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    await guild.bans.remove(targetUserId);

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
