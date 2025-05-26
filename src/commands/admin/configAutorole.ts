import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Role,
  ChatInputCommandInteraction,
  Guild,
  ButtonInteraction,
  Message,
  MessageFlags,
} from 'discord.js';
import { AutoRoleModel } from '../../models/AutoRole';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IAutoRole } from '../../interfaces/Models';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  ROLE_SELECT: 'autorole-select',
  CONFIRM: 'autorole-confirm',
  CANCEL: 'autorole-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-autorole')
  .setDescription('Konfiguruje automatyczne role dla nowych członków')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('pokaz').setDescription('Wyświetla aktualnie skonfigurowane automatyczne role')
  )
  .addSubcommand((sub) =>
    sub.setName('ustaw').setDescription('Konfiguruje automatyczne role dla nowych członków')
  )
  .addSubcommand((sub) =>
    sub.setName('usun').setDescription('Usuwa wszystkie skonfigurowane automatyczne role')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) {
      await interaction.editReply('Ta komenda może być użyta tylko na serwerze.');
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    switch (subcommand) {
      case 'ustaw':
        await handleSetup(interaction, guild);
        break;
      case 'usun':
        await handleClear(interaction, guild);
        break;
      case 'pokaz':
        await handleShow(interaction, guild);
        break;
    }
  } catch (error) {
    logger.error(`Błąd podczas konfiguracji autoroli: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas konfiguracji automatycznych ról.',
    });
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.ROLE_SELECT)
    .setPlaceholder('Wybierz role do automatycznego przydzielania')
    .setMinValues(1)
    .setMaxValues(10);

  const confirmButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const response = await interaction.editReply({
    content:
      '**UWAGA:** Pierwsza wybrana rola będzie przydzielana tylko do botów, a pozostałe tylko do użytkowników.\nWybierz role:',
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton),
    ],
  });

  const collector = response.createMessageComponentCollector({
    filter: (i) =>
      [CUSTOM_ID.ROLE_SELECT, CUSTOM_ID.CONFIRM, CUSTOM_ID.CANCEL].includes(i.customId),
    time: COLLECTION_TIMEOUT,
  });

  let selectedRoleIds: string[] = [];

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await i.deferUpdate();
    if (i.isRoleSelectMenu()) {
      selectedRoleIds = [...i.values];
    } else if (i.isButton()) {
      await handleButtonInteraction(i, guild, interaction, selectedRoleIds, collector);
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction
        .editReply({
          content: 'Czas na wybór minął. Spróbuj ponownie.',
          components: [],
        })
        .catch(logger.error);
    }
  });
}

async function handleShow(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await AutoRoleModel.findOne({ guildId: guild.id }).lean<IAutoRole>().exec();
  if (!cfg?.roleIds?.length) {
    await interaction.editReply('❌ Nie skonfigurowano żadnych automatycznych ról.');
    return;
  }
  const roles = cfg.roleIds
    .map((id: string) => guild.roles.cache.get(id))
    .filter((r: Role | undefined): r is Role => !!r);
  const embed = createAutoRoleEmbed(interaction, roles, false);
  await interaction.editReply({ embeds: [embed] });
}

async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  await AutoRoleModel.deleteOne({ guildId: guild.id });
  await interaction.editReply('✅ Wszystkie automatyczne role zostały usunięte.');
}

async function handleButtonInteraction(
  i: ButtonInteraction,
  guild: Guild,
  interaction: ChatInputCommandInteraction,
  selectedRoleIds: string[],
  collector: ReturnType<typeof Message.prototype.createMessageComponentCollector>
): Promise<void> {
  if (i.customId === CUSTOM_ID.CONFIRM) {
    if (!selectedRoleIds.length) {
      await interaction.editReply({
        content: 'Musisz wybrać co najmniej jedną rolę.',
        components: [],
      });
      return;
    }
    await AutoRoleModel.findOneAndUpdate(
      { guildId: guild.id },
      { guildId: guild.id, roleIds: selectedRoleIds },
      { upsert: true }
    );
    const roles = selectedRoleIds
      .map((id) => guild.roles.cache.get(id))
      .filter((r): r is Role => !!r);
    const embed = createAutoRoleEmbed(interaction, roles, true);
    await interaction.editReply({ content: '', embeds: [embed], components: [] });
  } else {
    await interaction.editReply({ content: 'Konfiguracja anulowana.', components: [] });
  }
  collector.stop();
}

function createAutoRoleEmbed(
  interaction: ChatInputCommandInteraction,
  roles: Role[],
  isSetup: boolean
) {
  const guild = interaction.guild;
  const embed = createBaseEmbed({
    title: isSetup ? 'Automatyczne role skonfigurowane' : 'Automatyczne role',
    description: isSetup
      ? 'Następujące role będą automatycznie dodawane:'
      : 'Poniższe role są automatycznie dodawane nowym członkom:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Rola dla botów',
    value: roles[0] ? `<@&${roles[0].id}>` : 'Brak roli dla botów',
  });

  embed.addFields({
    name: 'Role dla użytkowników',
    value:
      roles.length > 1
        ? roles
            .slice(1)
            .map((r) => `<@&${r.id}>`)
            .join('\n')
        : 'Brak ról dla użytkowników',
  });

  return embed;
}
