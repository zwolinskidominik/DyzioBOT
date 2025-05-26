import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { WarnModel, WarnDocument } from '../../models/Warn';
import type { ICommandOptions } from '../../interfaces/Command';
import { checkModPermissions } from '../../utils/moderationHelpers';
import { createBaseEmbed, formatWarnBar } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const WARN_LIMIT = 3;

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Nadaje ostrzeżenie użytkownikowi (max 3: mute 15m, 30m, potem ban).')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName('uzytkownik')
      .setDescription('Użytkownik, któremu chcesz nadać upomnienie.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('powod').setDescription('Powód upomnienia.').setRequired(true)
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

  const targetUser = interaction.options.getUser('uzytkownik', true);
  const reason = interaction.options.getString('powod', true);
  const guild = interaction.guild;
  const botId = interaction.client.user!.id;
  let member: GuildMember;

  try {
    member = await guild.members.fetch(targetUser.id);
  } catch {
    await interaction.editReply('Nie udało się znaleźć użytkownika na serwerze.');
    return;
  }
  if (
    !guild.members.me ||
    !checkModPermissions(member, interaction.member as GuildMember, guild.members.me)
  ) {
    logger.debug(
      `Warn command permissions check failed for ${interaction.user.tag} trying to warn ${targetUser.tag}`
    );
    await interaction.editReply('Nie masz uprawnień do ostrzegania tego użytkownika.');
    return;
  }

  let record = (await WarnModel.findOne({
    userId: targetUser.id,
    guildId: guild.id,
  })) as WarnDocument;
  if (!record) {
    record = new WarnModel({
      userId: targetUser.id,
      guildId: guild.id,
      warnings: [],
    }) as WarnDocument;
  }

  record.warnings.push({ reason, date: new Date(), moderator: interaction.user.tag });

  await record.save();

  const count = record.warnings.length;

  let muteDurationMs = 0;
  if (count === 1) muteDurationMs = 15 * 60 * 1000;
  else if (count === 2) muteDurationMs = 15 * 60 * 1000;
  else if (count >= 3) muteDurationMs = 24 * 60 * 60 * 1000;

  let muteEndTs: number | null = null;
  try {
    if (muteDurationMs > 0) {
      await member.timeout(muteDurationMs, reason);
      muteEndTs = Math.floor((Date.now() + muteDurationMs) / 1000);
    }
  } catch (err) {
    logger.error(`Błąd przy nakładaniu kary na ${member.id}: ${err}`);
  }

  const bar = formatWarnBar(botId, count);
  const percent = Math.round((count / WARN_LIMIT) * 100);

  const embed = createBaseEmbed({
    title: `Został nadany ${count} punkt ostrzeżeń`,
    color: COLORS.WARN,
    timestamp: false,
  }).addFields([
    { name: 'Użytkownik', value: `<@!${targetUser.id}>`, inline: true },
    { name: 'Moderator', value: `<@!${interaction.user.id}>`, inline: true },
    { name: 'Powód', value: reason, inline: false },
    {
      name: 'Czas trwania',
      value: muteEndTs ? `<t:${muteEndTs}:F>` : 'Brak wyciszenia',
      inline: false,
    },
    {
      name: 'Suma punktów',
      value: `Mute: ${count}p ${bar} ${WARN_LIMIT}p (${percent}%)`,
    },
  ]);

  await interaction.editReply({ embeds: [embed] });
}
