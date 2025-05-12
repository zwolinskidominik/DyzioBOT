import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  GuildBasedChannel,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageComponentInteraction,
} from 'discord.js';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import type { IQuestionConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'questions-channel-select',
  ROLE_SELECT: 'questions-role-select',
  CONFIRM: 'questions-confirm',
  CANCEL: 'questions-cancel',
  SKIP_ROLE: 'questions-skip-role',
};

const COLLECTION_TIMEOUT = 120_000;

export const data = new SlashCommandBuilder()
  .setName('config-questions')
  .setDescription('Skonfiguruj kanał pytań dnia.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName('setup').setDescription('Konfiguruje kanał pytań dnia.')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('clear').setDescription('Usuwa kanał pytań dnia.')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('show').setDescription('Wyświetla aktualnie skonfigurowany kanał pytań dnia')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
      await replyWithError(interaction, 'Ta komenda może być używana tylko na serwerze.');
      return;
    }

    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup':
        await handleSetupSubcommand(interaction, guild);
        break;
      case 'clear':
        await handleClearSubcommand(interaction, guild);
        break;
      case 'show':
        await handleShowSubcommand(interaction, guild);
        break;
    }
  } catch (error) {
    logger.error(`Błąd podczas konfiguracji kanału pytań dnia: ${error}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału pytań dnia.');
  }
}

async function handleSetupSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  let selectedChannelId: string | null = null;
  let selectedRoleId: string | null = null;
  let currentStep = 'channel';

  const collector = await createSetupCollector(interaction);
  await displayChannelSelection(interaction);

  collector.on('collect', async (i: MessageComponentInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await i.deferUpdate();

    if (i.isChannelSelectMenu() && i.customId === CUSTOM_ID.CHANNEL_SELECT) {
      selectedChannelId = i.values[0];
      currentStep = 'role';
      await displayRoleSelection(interaction);
      return;
    }

    if (i.isRoleSelectMenu() && i.customId === CUSTOM_ID.ROLE_SELECT) {
      selectedRoleId = i.values[0];
      currentStep = 'confirm';
      await displayConfirmation(interaction, guild, selectedChannelId, selectedRoleId);
      return;
    }

    if (i.isButton()) {
      if (i.customId === CUSTOM_ID.SKIP_ROLE && currentStep === 'role') {
        selectedRoleId = null;
        currentStep = 'confirm';
        await displayConfirmation(interaction, guild, selectedChannelId, null);
        return;
      }

      if (i.customId === CUSTOM_ID.CONFIRM && currentStep === 'confirm') {
        await handleConfirmation(interaction, guild, selectedChannelId, selectedRoleId);
        collector.stop();
        return;
      }

      if (i.customId === CUSTOM_ID.CANCEL) {
        await interaction.editReply({
          content: 'Konfiguracja anulowana.',
          components: [],
        });
        collector.stop();
        return;
      }
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      await interaction.editReply({
        content: 'Czas na wybór minął. Spróbuj ponownie.',
        components: [],
      });
    }
  });
}

async function createSetupCollector(interaction: ChatInputCommandInteraction) {
  const response = await interaction.fetchReply();

  return response.createMessageComponentCollector({
    filter: (i) => {
      const validIds = [
        CUSTOM_ID.CHANNEL_SELECT,
        CUSTOM_ID.ROLE_SELECT,
        CUSTOM_ID.CONFIRM,
        CUSTOM_ID.CANCEL,
        CUSTOM_ID.SKIP_ROLE,
      ];

      if (!validIds.includes(i.customId)) {
        logger.warn(`Otrzymano interakcję z nieobsługiwanym customId: ${i.customId}`);
        return false;
      }

      return true;
    },
    time: COLLECTION_TIMEOUT,
  });
}

async function displayChannelSelection(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał pytań dnia')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

  await interaction.editReply({
    content: '**Krok 1/3**: Wybierz kanał, na którym będą publikowane pytania dnia:',
    components: [channelRow, buttonRow],
  });
}

async function displayRoleSelection(interaction: ChatInputCommandInteraction): Promise<void> {
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.ROLE_SELECT)
    .setPlaceholder('Wybierz rolę do pingowania (opcjonalnie)')
    .setMinValues(1)
    .setMaxValues(1);

  const skipButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.SKIP_ROLE)
    .setLabel('Pomiń wybór roli')
    .setStyle(ButtonStyle.Secondary);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton, cancelButton);

  await interaction.editReply({
    content:
      '**Krok 2/3**: Wybierz rolę, która będzie pingowana przy wysyłaniu pytania (opcjonalnie):',
    components: [roleRow, buttonRow],
  });
}

async function displayConfirmation(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  channelId: string | null,
  roleId: string | null
): Promise<void> {
  if (!channelId) {
    await replyWithError(interaction, 'Nie wybrano kanału. Spróbuj ponownie.');
    return;
  }

  const selectedRole = roleId ? guild.roles.cache.get(roleId) : null;

  const confirmButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    confirmButton,
    cancelButton
  );

  let content = `**Krok 3/3**: Potwierdź wybrane ustawienia:\n\n`;
  content += `• Kanał pytań dnia: <#${channelId}>\n`;
  content += selectedRole
    ? `• Rola do pingowania: <@&${roleId}>\n`
    : `• Rola do pingowania: Brak (pytania będą publikowane bez pingowania roli)\n`;

  await interaction.editReply({
    content: content,
    components: [buttonRow],
  });
}

async function handleConfirmation(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  channelId: string | null,
  roleId: string | null
): Promise<void> {
  if (!channelId) {
    await replyWithError(interaction, 'Nie wybrano kanału. Spróbuj ponownie.');
    return;
  }

  if (!guild.channels.cache.has(channelId)) {
    await replyWithError(interaction, 'Nie udało się znaleźć wybranego kanału. Spróbuj ponownie.');
    return;
  }

  const selectedRole = roleId ? guild.roles.cache.get(roleId) : null;

  await QuestionConfigurationModel.findOneAndUpdate(
    { guildId: guild.id },
    {
      guildId: guild.id,
      questionChannelId: channelId,
      pingRoleId: roleId || undefined,
    },
    { upsert: true, new: true }
  );

  const embed = createBaseEmbed({
    title: '❓ Konfiguracja pytań dnia',
    description: `Konfiguracja pytań dnia została pomyślnie zakończona!`,
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Kanał pytań dnia',
    value: `<#${channelId}>`,
  });

  if (selectedRole) {
    embed.addFields({
      name: 'Rola do pingowania',
      value: `<@&${selectedRole.id}>`,
    });
  } else {
    embed.addFields({
      name: 'Rola do pingowania',
      value: 'Brak (pytania będą publikowane bez pingowania roli)',
    });
  }

  await interaction.editReply({
    content: '',
    embeds: [embed],
    components: [],
  });
}

async function handleClearSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await QuestionConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<IQuestionConfiguration>()
    .exec();

  if (!existingConfig) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału pytań dnia.\nAby skonfigurować, uruchom `/config-questions setup`.'
    );
    return;
  }

  await QuestionConfigurationModel.findOneAndDelete({ guildId: guild.id });

  await replyWithSuccess(
    interaction,
    'Usunięto kanał pytań dnia.\nAby skonfigurować ponownie, uruchom `/config-questions setup`.'
  );
}

async function handleShowSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await QuestionConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<IQuestionConfiguration>()
    .exec();

  if (!existingConfig || !existingConfig.questionChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału pytań dnia.\nAby skonfigurować, uruchom `/config-questions setup`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(existingConfig.questionChannelId) as GuildBasedChannel;

  if (!channel) {
    await replyWithError(
      interaction,
      'Skonfigurowany kanał pytań dnia nie istnieje. Zalecamy ponowną konfigurację.'
    );
    return;
  }

  const embed = createBaseEmbed({
    title: '❓ Konfiguracja pytań dnia',
    description: 'Aktualna konfiguracja kanału pytań dnia dla tego serwera:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Kanał pytań dnia',
    value: `<#${channel.id}>`,
  });

  if (existingConfig.pingRoleId) {
    const role = guild.roles.cache.get(existingConfig.pingRoleId);

    if (role) {
      embed.addFields({
        name: 'Rola do pingowania',
        value: `<@&${role.id}>`,
      });
    } else {
      embed.addFields({
        name: 'Rola do pingowania',
        value: 'Skonfigurowano rolę do pingowania, ale rola nie istnieje.',
      });
    }
  } else {
    embed.addFields({
      name: 'Rola do pingowania',
      value: 'Brak (pytania są publikowane bez pingowania roli)',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const errorEmbed = createBaseEmbed({ isError: true, description: message });
  await interaction.editReply({ embeds: [errorEmbed] });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const successEmbed = createBaseEmbed({ description: message });
  await interaction.editReply({ embeds: [successEmbed] });
}
