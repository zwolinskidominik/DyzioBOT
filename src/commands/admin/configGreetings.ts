import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  MessageFlags,
  ChatInputCommandInteraction,
  Guild,
  GuildBasedChannel,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ActionRowBuilder,
  Message,
} from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import type { IGreetingsConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'greetings-channel-select',
  CONFIRM: 'greetings-confirm',
  CANCEL: 'greetings-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-greetings')
  .setDescription('Skonfiguruj karty powitalne i pożegnalne.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('setup').setDescription('Konfiguruje kanał powitań i pożegnań.')
  )
  .addSubcommand((sub) => sub.setName('clear').setDescription('Usuwa kanał powitań i pożegnań.'))
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Wyświetla aktualnie skonfigurowany kanał powitań.')
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
        await handleSetup(interaction, guild);
        break;
      case 'clear':
        await handleClear(interaction, guild);
        break;
      case 'show':
        await handleShow(interaction, guild);
        break;
    }
  } catch (err) {
    logger.error(`Błąd podczas konfiguracji kanału powitań: ${err}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału powitań.');
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał powitań')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const confirmBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź')
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const rowMenu = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu);
  const rowBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

  const reply = await interaction.editReply({
    content: 'Wybierz kanał, na który będą wysyłane karty powitalne i pożegnalne:',
    components: [rowMenu, rowBtn],
  });

  let selectedChannelId: string | null = null;

  const collector = (reply as Message).createMessageComponentCollector({
    filter: (i): i is ChannelSelectMenuInteraction | ButtonInteraction =>
      i.user.id === interaction.user.id,
    time: COLLECTION_TIMEOUT,
  });

  collector.on('collect', async (i) => {
    await i.deferUpdate();

    if (i.isChannelSelectMenu()) {
      selectedChannelId = i.values[0];
      return;
    }

    if (i.isButton()) {
      await handleButtonInteraction(
        i,
        guild,
        interaction,
        selectedChannelId,
        rowMenu,
        rowBtn,
        collector
      );
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction.editReply({
        content: 'Czas na wybór minął. Spróbuj ponownie.',
        components: [],
      });
    }
  });
}

async function handleButtonInteraction(
  i: ButtonInteraction,
  guild: Guild,
  interaction: ChatInputCommandInteraction,
  selectedChannelId: string | null,
  rowMenu: ActionRowBuilder<ChannelSelectMenuBuilder>,
  rowBtn: ActionRowBuilder<ButtonBuilder>,
  collector: ReturnType<Message['createMessageComponentCollector']>
): Promise<void> {
  if (i.customId === CUSTOM_ID.CONFIRM) {
    if (!selectedChannelId) {
      await interaction.editReply({
        content: 'Musisz wybrać kanał.',
        components: [rowMenu, rowBtn],
      });
      return;
    }

    const channel = guild.channels.cache.get(selectedChannelId) as TextChannel | undefined;
    if (!channel) {
      await replyWithError(interaction, 'Nie znalazłem wybranego kanału. Spróbuj ponownie.');
      collector.stop();
      return;
    }

    await GreetingsConfigurationModel.findOneAndUpdate(
      { guildId: guild.id },
      { guildId: guild.id, greetingsChannelId: channel.id },
      { upsert: true, new: true }
    );

    const embed = createBaseEmbed({
      title: '👋 Konfiguracja powitań',
      description: 'Kanał powitań i pożegnań został skonfigurowany!',
      footerText: guild?.name || '',
      footerIcon: guild?.iconURL() || undefined,
    }).addFields({
      name: 'Kanał powitań/pożegnań',
      value: `<#${channel.id}>`,
    });

    await interaction.editReply({ content: '', embeds: [embed], components: [] });
  } else {
    await interaction.editReply({ content: 'Konfiguracja anulowana.', components: [] });
  }

  collector.stop();
}

async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await GreetingsConfigurationModel.findOne({ guildId: guild.id })
    .lean<IGreetingsConfiguration>()
    .exec();

  if (!cfg) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powitań.\n' +
        'Aby skonfigurować, uruchom `/config-greetings setup`.'
    );
    return;
  }

  await GreetingsConfigurationModel.deleteOne({ guildId: guild.id });
  await replyWithSuccess(
    interaction,
    'Kanał powitań został wyłączony.\n' +
      'Aby skonfigurować ponownie, uruchom `/config-greetings setup`.'
  );
}

async function handleShow(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await GreetingsConfigurationModel.findOne({ guildId: guild.id })
    .lean<IGreetingsConfiguration>()
    .exec();

  if (!cfg?.greetingsChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powitań.\n' +
        'Aby skonfigurować, uruchom `/config-greetings setup`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(cfg.greetingsChannelId) as GuildBasedChannel | undefined;
  if (!channel) {
    await replyWithError(interaction, 'Skonfigurowany kanał nie istnieje. Skonfiguruj ponownie.');
    return;
  }

  const embed = createBaseEmbed({
    title: '👋 Konfiguracja powitań',
    description: 'Aktualna konfiguracja kanału powitań/pożegnań:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  }).addFields({
    name: 'Kanał powitań/pożegnań',
    value: `<#${channel.id}>`,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.editReply({
    embeds: [createBaseEmbed({ isError: true, description: message })],
  });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.editReply({
    embeds: [createBaseEmbed({ description: message })],
  });
}
