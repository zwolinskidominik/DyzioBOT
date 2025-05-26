import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  User,
  Guild,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  createModErrorEmbed,
  createModSuccessEmbed,
  formatDuration,
} from '../../utils/moderationHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Wysyła użytkownika na wakacje od serwera.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
};

function parseDuration(durationStr: string): number {
  const regex = /(\d+)\s*(d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let totalMs = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let multiplier = 0;

    if (unit.startsWith('d')) {
      multiplier = 86400000;
    } else if (unit.startsWith('h')) {
      multiplier = 3600000;
    } else if (unit.startsWith('m')) {
      multiplier = 60000;
    } else if (unit.startsWith('s')) {
      multiplier = 1000;
    }

    totalMs += value * multiplier;
  }

  return totalMs;
}

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

    const targetUser: User = interaction.options.getUser('uzytkownik', true);
    if (!targetUser) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(`**${'Nie znaleziono użytkownika.'}**`)],
      });
      return;
    }

    const duration: string = interaction.options.getString('czas_trwania', true);
    if (!duration) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(`**${'Nie podano czasu wyciszenia.'}**`)],
      });
      return;
    }

    const reason: string = interaction.options.getString('powod', true);

    let targetMember: GuildMember;
    try {
      targetMember = await guild.members.fetch(targetUser.id);
    } catch (error) {
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(`**${'Taki użytkownik nie istnieje na tym serwerze.'}**`),
        ],
      });
      return;
    }

    const msDuration: number = parseDuration(duration);
    if (!msDuration || msDuration < 5000 || msDuration > 2.419e9) {
      await interaction.editReply({
        content: 'Podaj prawidłową wartość czasu trwania wyciszenia (5 sekund - 28 dni).',
      });
      return;
    }

    if (!guild.members.me) {
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(`**${'Wystąpił błąd podczas sprawdzania uprawnień bota.'}**`),
        ],
      });
      return;
    }

    const targetUserRolePosition: number = targetMember.roles.highest.position;
    const requestUserRolePosition: number = (interaction.member as GuildMember).roles.highest
      .position;
    const botRolePosition: number = guild.members.me.roles.highest.position;

    if (
      targetUserRolePosition >= requestUserRolePosition ||
      targetUserRolePosition >= botRolePosition
    ) {
      await interaction.editReply({
        content: 'Nie możesz wyciszyć użytkownika z wyższą lub równą rolą.',
      });
      return;
    }

    const prettyDuration = await formatDuration(msDuration);
    const prettyDurationFixed = prettyDuration.replace(/(\d+)\s?m(?![a-zA-Z])/, '$1 min');

    const wasMuted = targetMember.isCommunicationDisabled();
    await targetMember.timeout(msDuration, reason);

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
          `**${'Wystąpił błąd podczas wysyłania użytkownika na przerwę.'}**`
        ),
      ],
    });
  }
}
