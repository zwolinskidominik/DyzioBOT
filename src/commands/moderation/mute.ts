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
  parseDuration,
  formatHumanDuration,
} from '../../utils/moderationHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { checkCommandAccess } from '../../services/moderationConfigService';
import { logModerationAction } from '../../services/moderationLogService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Wycisz użytkownika na określony czas')
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, którego chcesz wyciszyć.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('czas_trwania')
      .setDescription('Czas trwania wyciszenia (np. 30min, 1h, 1 dzień, 2h 30min).')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('powod').setDescription('Powód wyciszenia.').setRequired(true)
  );

export const options = {
  // userPermissions celowo pominięte — dostęp sprawdzamy ręcznie przez checkCommandAccess()
  // (extraRoleIds z ModerationConfig ma prawo przepuścić moderatora bez natywnego uprawnienia).
  botPermissions: PermissionFlagsBits.MuteMembers,
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
      commandKey: 'mute',
      requiredPermission: PermissionFlagsBits.MuteMembers,
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

    const duration = interaction.options.getString('czas_trwania');
    if (!duration) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('**Nie podano czasu wyciszenia.**')],
      });
      return;
    }

    const reason = interaction.options.getString('powod');
    if (!reason) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('**Nie podano powodu.**')],
      });
      return;
    }

    let targetMember: GuildMember;
    try {
      targetMember = await guild.members.fetch(targetUser.id);
    } catch (error) {
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription('**Taki użytkownik nie istnieje na tym serwerze.**'),
        ],
      });
      return;
    }

    const msDuration = parseDuration(duration);
    if (!msDuration) {
      await interaction.editReply({
        content: 'Podaj prawidłową wartość czasu trwania wyciszenia (5 sekund - 28 dni).',
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

    const failMessage = getModFailMessage(targetMember, interaction.member as GuildMember, guild.members.me, 'mute');
    if (failMessage) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(`**${failMessage}**`)],
      });
      return;
    }

    const prettyDuration = formatHumanDuration(msDuration);
    const prettyDurationFixed = prettyDuration.replace(/(\d+)\s?m(?![a-zA-Z])/, '$1 min');

    if (config.mute.dm) {
      try {
        await targetUser.send({
          embeds: [createBaseEmbed({
            title: '🔇 Zostałeś wyciszony',
            description:
              `**Serwer:** ${guild.name}\n` +
              `**Czas trwania:** ${prettyDurationFixed}\n` +
              `**Powód:** ${reason}\n` +
              `**Moderator:** <@${interaction.user.id}>`,
            color: COLORS.WARN,
          })],
        });
      } catch {
        logger.debug(`Nie można wysłać DM do ${targetUser.tag}`);
      }
    }

    const wasMuted = targetMember.isCommunicationDisabled();
    await targetMember.timeout(msDuration, reason);

    if (config.mute.log) {
      await logModerationAction({
        guildId: guild.id,
        kind: 'mute',
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
        extra: prettyDurationFixed,
      });
    }

    let description = '';
    if (wasMuted) {
      description = `**Czas wyciszenia ${targetMember} został zaktualizowany: ${prettyDurationFixed}**`;
    } else {
      description = `**${targetMember} został/a wyciszony/a na okres ${prettyDurationFixed}**`;
    }

    const successEmbed = createModSuccessEmbed(
      'mute',
      targetUser,
      interaction.user,
      interaction.guild!.iconURL(),
      interaction.guild!.name,
      reason,
      prettyDurationFixed
    );

    successEmbed.setDescription(description);

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas wyciszania użytkownika: ${error}`);
    await interaction.editReply({
      embeds: [
        errorEmbed.setDescription(
          '**Wystąpił błąd podczas wysyłania użytkownika na przerwę.**'
        ),
      ],
    });
  }
}
