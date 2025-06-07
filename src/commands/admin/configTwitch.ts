import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  GuildBasedChannel,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageComponentInteraction,
} from 'discord.js';
import { StreamConfigurationModel } from '../../models/StreamConfiguration';
import type { IStreamConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'twitch-channel-select',
  CONFIRM: 'twitch-confirm',
  CANCEL: 'twitch-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-twitch')
  .setDescription('Skonfiguruj kanał powiadomień o streamach Twitch.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName('set').setDescription('Konfiguruje kanał powiadomień o streamach Twitch.')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('remove').setDescription('Usuwa kanał powiadomień o streamach Twitch.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('show')
      .setDescription('Wyświetla aktualnie skonfigurowany kanał powiadomień o streamach Twitch')
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
      case 'set':
        await handleSetupSubcommand(interaction, guild);
        break;
      case 'remove':
        await handleClearSubcommand(interaction, guild);
        break;
      case 'show':
        await handleShowSubcommand(interaction, guild);
        break;
    }
  } catch (error) {
    logger.error(`Błąd podczas konfiguracji kanału powiadomień Twitch: ${error}`);
    await replyWithError(
      interaction,
      'Wystąpił błąd podczas konfiguracji kanału powiadomień Twitch.'
    );
  }
}

async function handleSetupSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał powiadomień Twitch')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const confirmButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    confirmButton,
    cancelButton
  );

  const response = await interaction.editReply({
    content: 'Wybierz kanał, na którym będą publikowane powiadomienia o streamach Twitch:',
    components: [channelRow, buttonRow],
  });

  try {
    const collector = response.createMessageComponentCollector({
      filter: (i) =>
        i.customId === CUSTOM_ID.CHANNEL_SELECT ||
        i.customId === CUSTOM_ID.CONFIRM ||
        i.customId === CUSTOM_ID.CANCEL,
      time: COLLECTION_TIMEOUT,
    });

    let selectedChannelId: string | null = null;

    collector.on('collect', async (i: MessageComponentInteraction) => {
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
      } else if (i.isButton()) {
        if (i.customId === CUSTOM_ID.CONFIRM) {
          if (!selectedChannelId) {
            await interaction.editReply({
              content: 'Musisz wybrać kanał.',
              components: [channelRow, buttonRow],
            });
            return;
          }

          const channel = guild.channels.cache.get(selectedChannelId) as TextChannel;
          if (!channel) {
            await replyWithError(
              interaction,
              'Nie udało się znaleźć wybranego kanału. Spróbuj ponownie.'
            );
            collector.stop();
            return;
          }

          await saveTwitchChannel(guild.id, channel.id);

          const embed = createBaseEmbed({
            title: '📺 Konfiguracja kanału powiadomień Twitch',
            description: `Kanał powiadomień Twitch został skonfigurowany!`,
            footerText: guild?.name || '',
            footerIcon: guild?.iconURL() || undefined,
            color: COLORS.TWITCH,
          });

          embed.addFields({
            name: 'Kanał powiadomień',
            value: `<#${channel.id}>`,
          });

          embed.addFields({
            name: 'Jak to działa',
            value:
              'Na tym kanale będą się pojawiać powiadomienia o rozpoczętych streamach.\nAby dodać streamerów do śledzenia, użyj komendy `/twitch add`.',
          });

          await interaction.editReply({
            content: '',
            embeds: [embed],
            components: [],
          });
        } else {
          await interaction.editReply({
            content: 'Konfiguracja anulowana.',
            components: [],
          });
        }

        collector.stop();
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
  } catch (error) {
    logger.error(`Błąd w interakcji menu kanałów: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas konfiguracji.',
      components: [],
    });
  }
}

async function saveTwitchChannel(guildId: string, channelId: string): Promise<void> {
  try {
    await StreamConfigurationModel.findOneAndUpdate(
      { guildId },
      { guildId, channelId },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error(`Błąd podczas zapisywania kanału powiadomień Twitch: ${error}`);
    throw error;
  }
}

async function handleClearSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await StreamConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<IStreamConfiguration>()
    .exec();

  if (!existingConfig) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powiadomień Twitch.\nAby skonfigurować, uruchom `/config-twitch set`.'
    );
    return;
  }

  await StreamConfigurationModel.findOneAndDelete({ guildId: guild.id });

  await replyWithSuccess(
    interaction,
    'Usunięto kanał powiadomień Twitch.\nAby skonfigurować ponownie, uruchom `/config-twitch set`.'
  );
}

async function handleShowSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await StreamConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<IStreamConfiguration>()
    .exec();

  if (!existingConfig || !existingConfig.channelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powiadomień Twitch.\nAby skonfigurować, uruchom `/config-twitch set`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(existingConfig.channelId) as GuildBasedChannel;

  if (!channel) {
    await replyWithError(
      interaction,
      'Skonfigurowany kanał powiadomień Twitch nie istnieje. Zalecamy ponowną konfigurację.'
    );
    return;
  }

  const embed = createBaseEmbed({
    title: '📺 Konfiguracja kanału powiadomień Twitch',
    description: 'Aktualna konfiguracja kanału powiadomień Twitch dla tego serwera:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
    color: COLORS.TWITCH,
  });

  embed.addFields({
    name: 'Kanał powiadomień',
    value: `<#${channel.id}>`,
  });

  embed.addFields({
    name: 'Jak to działa',
    value:
      'Na tym kanale będą się pojawiać powiadomienia o rozpoczętych streamach.\nAby dodać streamerów do śledzenia, użyj komendy `/twitch add`.',
  });

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const errorEmbed = createBaseEmbed({
    isError: true,
    description: message,
  });
  await interaction.editReply({ embeds: [errorEmbed] });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const successEmbed = createBaseEmbed({
    description: message,
    color: COLORS.TWITCH,
  });
  await interaction.editReply({ embeds: [successEmbed] });
}
