import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  Role,
  time,
  TimestampStyles,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { parseDuration, formatHumanDuration } from '../../utils/moderationHelpers';
import { addTempRole, removeTempRole, listTempRoles } from '../../services/tempRoleService';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Zarządzanie rolami na serwerze')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('temp')
      .setDescription('Nadaje rolę na określony czas')
      .addUserOption((opt) =>
        opt.setName('uzytkownik').setDescription('Użytkownik, któremu nadajesz rolę').setRequired(true)
      )
      .addRoleOption((opt) =>
        opt.setName('rola').setDescription('Rola do nadania').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('czas')
          .setDescription("Czas trwania (np. '1d 2h 30m', '5h', '30m')")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('powod').setDescription('Powód nadania roli (opcjonalnie)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Usuwa tymczasową rolę przed czasem')
      .addUserOption((opt) =>
        opt.setName('uzytkownik').setDescription('Użytkownik').setRequired(true)
      )
      .addRoleOption((opt) =>
        opt.setName('rola').setDescription('Rola do usunięcia').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Wyświetla aktywne tymczasowe role')
      .addUserOption((opt) =>
        opt.setName('uzytkownik').setDescription('Filtruj po użytkowniku (opcjonalnie)').setRequired(false)
      )
  );

export const options = {
  userPermissions: PermissionFlagsBits.ManageRoles,
  botPermissions: PermissionFlagsBits.ManageRoles,
  guildOnly: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'temp':
      return handleTemp(interaction);
    case 'remove':
      return handleRemove(interaction);
    case 'list':
      return handleList(interaction);
  }
}

/* ── /role temp ──────────────────────────────────────────────────────── */

async function handleTemp(interaction: ICommandOptions['interaction']): Promise<void> {
  await interaction.deferReply();

  const guild = interaction.guild!;
  const targetUser = interaction.options.getUser('uzytkownik', true);
  const role = interaction.options.getRole('rola', true) as Role;
  const durationStr = interaction.options.getString('czas', true);
  const reason = interaction.options.getString('powod') ?? undefined;

  // Parse duration
  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Podaj prawidłowy czas trwania (5 sekund – 28 dni).\nPrzykłady: `1d 2h`, `30m`, `5h 30m`')],
    });
    return;
  }

  // Fetch members
  let targetMember: GuildMember;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie znaleziono tego użytkownika na serwerze.')],
    });
    return;
  }

  const botMember = guild.members.me;
  if (!botMember) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie udało się sprawdzić uprawnień bota.')],
    });
    return;
  }

  // Validate role hierarchy
  const requestMember = interaction.member as GuildMember;
  if (role.position >= requestMember.roles.highest.position && guild.ownerId !== requestMember.id) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie możesz nadać roli wyższej lub równej Twojej najwyższej roli.')],
    });
    return;
  }

  if (role.position >= botMember.roles.highest.position) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Moja rola jest za nisko, aby nadać tę rolę.')],
    });
    return;
  }

  if (role.managed) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Ta rola jest zarządzana przez integrację i nie może być nadana.')],
    });
    return;
  }

  // Add Discord role
  try {
    await targetMember.roles.add(role, `Temp role – ${reason ?? 'Tymczasowa rola'}`);
  } catch (error) {
    logger.error(`[role temp] Nie udało się nadać roli: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie udało się nadać roli. Sprawdź uprawnienia bota.')],
    });
    return;
  }

  // Save to DB
  const result = await addTempRole(guild.id, targetUser.id, role.id, durationMs, interaction.user.id, reason);
  if (!result.ok) {
    await interaction.editReply({
      embeds: [createErrorEmbed(result.message)],
    });
    return;
  }

  const expiresAt = result.data.expiresAt;
  const prettyDuration = formatHumanDuration(durationMs);

  const embed = createBaseEmbed({
    description: [
      `### ⏱️ Tymczasowa rola nadana`,
      '',
      `**Użytkownik:** ${targetUser}`,
      `**Rola:** ${role}`,
      `**Czas:** ${prettyDuration}`,
      `**Wygasa:** ${time(expiresAt, TimestampStyles.RelativeTime)} (${time(expiresAt, TimestampStyles.ShortDateTime)})`,
      reason ? `**Powód:** ${reason}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    footerText: guild.name,
    footerIcon: guild.iconURL() ?? undefined,
    timestamp: true,
  });

  await interaction.editReply({ embeds: [embed] });
}

/* ── /role remove ────────────────────────────────────────────────────── */

async function handleRemove(interaction: ICommandOptions['interaction']): Promise<void> {
  await interaction.deferReply();

  const guild = interaction.guild!;
  const targetUser = interaction.options.getUser('uzytkownik', true);
  const role = interaction.options.getRole('rola', true) as Role;

  // Remove from DB
  const result = await removeTempRole(guild.id, targetUser.id, role.id);
  if (!result.ok) {
    await interaction.editReply({
      embeds: [createErrorEmbed(result.message)],
    });
    return;
  }

  if (!result.data) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie znaleziono takiej tymczasowej roli dla tego użytkownika.')],
    });
    return;
  }

  // Remove Discord role
  try {
    const member = await guild.members.fetch(targetUser.id);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Temp role – wcześniejsze usunięcie');
    }
  } catch (error) {
    logger.warn(`[role remove] Nie udało się usunąć roli z Discord: ${error}`);
  }

  const embed = createBaseEmbed({
    description: `### ✅ Tymczasowa rola usunięta\n\n**Użytkownik:** ${targetUser}\n**Rola:** ${role}`,
    footerText: guild.name,
    footerIcon: guild.iconURL() ?? undefined,
    timestamp: true,
  });

  await interaction.editReply({ embeds: [embed] });
}

/* ── /role list ──────────────────────────────────────────────────────── */

async function handleList(interaction: ICommandOptions['interaction']): Promise<void> {
  await interaction.deferReply();

  const guild = interaction.guild!;
  const filterUser = interaction.options.getUser('uzytkownik') ?? undefined;

  const result = await listTempRoles(guild.id, filterUser?.id);
  if (!result.ok) {
    await interaction.editReply({
      embeds: [createErrorEmbed(result.message)],
    });
    return;
  }

  const entries = result.data;
  if (entries.length === 0) {
    const desc = filterUser
      ? `Brak aktywnych tymczasowych ról dla ${filterUser}.`
      : 'Brak aktywnych tymczasowych ról na tym serwerze.';

    await interaction.editReply({
      embeds: [createBaseEmbed({ description: desc })],
    });
    return;
  }

  const lines = entries.map((e, i) => {
    const expires = time(e.expiresAt, TimestampStyles.RelativeTime);
    return `**${i + 1}.** <@${e.userId}> — <@&${e.roleId}> · wygasa ${expires}`;
  });

  const title = filterUser
    ? `Tymczasowe role dla ${filterUser.tag}`
    : 'Tymczasowe role na serwerze';

  const embed = createBaseEmbed({
    title: `⏱️ ${title}`,
    description: lines.join('\n'),
    footerText: `${entries.length} aktywnych · ${guild.name}`,
    footerIcon: guild.iconURL() ?? undefined,
    timestamp: true,
  });

  await interaction.editReply({ embeds: [embed] });
}
