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
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { logModerationAction } from '../../services/moderationLogService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Zbanuj użytkownika na serwerze')
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
      commandKey: 'ban',
      requiredPermission: PermissionFlagsBits.BanMembers,
    });
    if (!access.allowed) {
      await interaction.editReply({ embeds: [errorEmbed.setDescription(`**${access.reason}**`)] });
      return;
    }
    const { config } = access;

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

    if (config.ban.dm) {
      // DM PRZED banem — po zbanowaniu użytkownik może nie dzielić z nami już żadnego
      // wspólnego serwera, co blokuje wysyłkę DM.
      try {
        await targetUser.send({
          embeds: [createBaseEmbed({
            title: '🚫 Zostałeś zbanowany',
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

    await targetMember.ban({
      reason,
      deleteMessageSeconds: 86_400,
    });

    if (config.ban.log) {
      await logModerationAction({
        guildId: guild.id,
        kind: 'ban',
        targetId: targetUserId,
        targetTag: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
      });
    }

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
