import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  User,
  Guild,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  getModFailMessage,
} from '../../utils/moderationHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Banuje użytkownika na serwerze.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego chcesz zbanować.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('powod').setDescription('Powód zbanowania.').setRequired(true)
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

    const targetUser: User = interaction.options.getUser('uzytkownik', true);
    const targetUserId: string = targetUser.id;
    const reason: string = interaction.options.getString('powod', true);

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

    const failMessage = getModFailMessage(targetMember, interaction.member as GuildMember, guild.members.me, 'ban');
    if (failMessage) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(`**${failMessage}**`)],
      });
      return;
    }

    await targetMember.ban({
      reason,
      deleteMessageSeconds: 86_400,
    });

    const successEmbed = createModSuccessEmbed(
      'ban',
      targetUser,
      interaction.user,
      interaction.guild!.iconURL(),
      interaction.guild!.name,
      reason
    );

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Wystąpił błąd podczas banowania użytkownika: ${error}`);
    await interaction.editReply({
      embeds: [errorEmbed.setDescription('**Wystąpił błąd podczas banowania.**')],
    });
  }
}
