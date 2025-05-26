import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonInteraction,
  GuildBasedChannel,
  Message,
} from 'discord.js';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
import type { IBirthdayConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'birthday-channel-select',
  CONFIRM: 'birthday-confirm',
  CANCEL: 'birthday-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-urodziny')
  .setDescription('Skonfiguruj kanał do wysyłania życzeń urodzinowych.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('ustaw').setDescription('Konfiguruje kanał do wysyłania życzeń urodzinowych.')
  )
  .addSubcommand((sub) =>
    sub.setName('usun').setDescription('Usuwa kanał do wysyłania życzeń urodzinowych.')
  )
  .addSubcommand((sub) =>
    sub.setName('pokaz').setDescription('Wyświetla aktualnie skonfigurowany kanał urodzinowy.')
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
  } catch (err) {
    logger.error(`Błąd podczas konfiguracji kanału urodzinowego: ${err}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału urodzinowego.');
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał urodzinowy')
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

  const menuRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu);
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

  const response = await interaction.editReply({
    content: 'Wybierz kanał, na który bot będzie wysyłał życzenia urodzinowe:',
    components: [menuRow, btnRow],
  });
  const collector = response.createMessageComponentCollector({
    filter: (i): i is ChannelSelectMenuInteraction | ButtonInteraction =>
      i.user.id === interaction.user.id,
    time: COLLECTION_TIMEOUT,
  });

  let selectedChannelId: string | null = null;

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await i.deferUpdate();

    if (i.isChannelSelectMenu()) {
      selectedChannelId = i.values[0];
      return;
    } else if (i.isButton()) {
      await handleButtonInteraction(
        i,
        guild,
        interaction,
        selectedChannelId,
        menuRow,
        btnRow,
        collector
      );
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction
        .editReply({
          content: 'Czas na wybór minął. Spróbuj ponownie.',
          components: [],
        })
        .catch(logger.error);
    }
  });
}

async function handleButtonInteraction(
  i: ButtonInteraction,
  guild: Guild,
  interaction: ChatInputCommandInteraction,
  selectedChannelId: string | null,
  menuRow: ActionRowBuilder<ChannelSelectMenuBuilder>,
  btnRow: ActionRowBuilder<ButtonBuilder>,
  collector: ReturnType<Message['createMessageComponentCollector']>
): Promise<void> {
  if (i.customId === CUSTOM_ID.CONFIRM) {
    if (!selectedChannelId) {
      await interaction.editReply({
        content: 'Musisz wybrać kanał.',
        components: [menuRow, btnRow],
      });
      return;
    }

    const channel = guild.channels.cache.get(selectedChannelId) as TextChannel | undefined;
    if (!channel) {
      await replyWithError(
        interaction,
        'Nie udało się znaleźć wybranego kanału. Spróbuj ponownie.'
      );
      collector.stop();
      return;
    }

    await BirthdayConfigurationModel.findOneAndUpdate(
      { guildId: guild.id },
      { guildId: guild.id, birthdayChannelId: channel.id },
      { upsert: true, new: true }
    );

    const embed = createBaseEmbed({
      title: '🎂 Konfiguracja urodzin',
      description: 'Kanał urodzinowy został skonfigurowany!',
      footerText: guild?.name || '',
      footerIcon: guild?.iconURL() || undefined,
    }).addFields({
      name: 'Kanał urodzinowy',
      value: `<#${channel.id}>`,
    });

    await interaction.editReply({ content: '', embeds: [embed], components: [] });
  } else {
    await interaction.editReply({ content: 'Konfiguracja anulowana.', components: [] });
  }

  collector.stop();
}

async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await BirthdayConfigurationModel.findOne({ guildId: guild.id })
    .lean<IBirthdayConfiguration>()
    .exec();

  if (!cfg) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału do wysyłania życzeń urodzinowych.\n' +
        'Aby skonfigurować, uruchom `/config-urodziny ustaw`.'
    );
    return;
  }

  await BirthdayConfigurationModel.deleteOne({ guildId: guild.id });
  logger.info(`Usunięto kanał urodzin w guildId=${guild.id}`);

  await replyWithSuccess(
    interaction,
    'Usunięto kanał do wysyłania życzeń urodzinowych.\n' +
      'Aby skonfigurować ponownie, uruchom `/config-urodziny ustaw`.'
  );
}

async function handleShow(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await BirthdayConfigurationModel.findOne({ guildId: guild.id })
    .lean<IBirthdayConfiguration>()
    .exec();

  if (!cfg?.birthdayChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału do wysyłania życzeń urodzinowych.\n' +
        'Aby skonfigurować, uruchom `/config-urodziny ustaw`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(cfg.birthdayChannelId) as GuildBasedChannel | undefined;
  if (!channel) {
    await replyWithError(interaction, 'Skonfigurowany kanał nie istnieje. Skonfiguruj ponownie.');
    return;
  }

  const embed = createBaseEmbed({
    title: '🎂 Konfiguracja urodzin',
    description: 'Aktualna konfiguracja kanału urodzinowego:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  }).addFields({
    name: 'Kanał urodzinowy',
    value: `<#${channel.id}>`,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  msg: string
): Promise<void> {
  await interaction.editReply({ embeds: [createBaseEmbed({ isError: true, description: msg })] });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  msg: string
): Promise<void> {
  await interaction.editReply({ embeds: [createBaseEmbed({ description: msg })] });
}
