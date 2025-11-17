import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  Guild,
  TextChannel,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageComponentInteraction,
  StringSelectMenuBuilder,
} from 'discord.js';
import { MonthlyStatsConfigModel } from '../../models/MonthlyStatsConfig';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';
import type { ICommandOptions } from '../../interfaces/Command';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'monthly-stats-channel-select',
  COUNT_SELECT: 'monthly-stats-count-select',
  ENABLE_BUTTON: 'monthly-stats-enable',
  DISABLE_BUTTON: 'monthly-stats-disable',
  TEST_BUTTON: 'monthly-stats-test',
  CONFIRM: 'monthly-stats-confirm',
  CANCEL: 'monthly-stats-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-monthly-stats')
  .setDescription('⚙ Konfiguracja miesięcznych statystyk')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('set').setDescription('🔧 Konfiguruj miesięczne statystyki')
  )
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('🗑 Usuń konfigurację statystyk')
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('ℹ Pokaż aktualną konfigurację')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
        await handleRemoveSubcommand(interaction, guild);
        break;
      case 'show':
        await handleShowSubcommand(interaction, guild);
        break;
    }
  } catch (error) {
    logger.error(`Błąd podczas konfiguracji miesięcznych statystyk: ${error}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji.');
  }
}

async function handleSetupSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const config = await MonthlyStatsConfigModel.findOne({ guildId: guild.id });

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał do wysyłania statystyk')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const countOptions = Array.from({ length: 25 }, (_, i) => ({
    label: `${i + 1} użytkowników`,
    value: `${i + 1}`,
    default: (config?.topCount || 10) === i + 1,
  }));

  const countMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.COUNT_SELECT)
    .setPlaceholder(`Liczba użytkowników w topce (aktualnie: ${config?.topCount || 10})`)
    .addOptions(countOptions);

  const enableButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.ENABLE_BUTTON)
    .setLabel('✅ Włącz')
    .setStyle(ButtonStyle.Success)
    .setDisabled(config?.enabled || false);

  const disableButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.DISABLE_BUTTON)
    .setLabel('❌ Wyłącz')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!config?.enabled);

  const confirmButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź')
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Secondary);

  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu);
  const countRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(countMenu);
  const statusRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    enableButton,
    disableButton
  );
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    confirmButton,
    cancelButton
  );

  const currentChannel = config?.channelId ? `<#${config.channelId}>` : '❌ Nie ustawiono';
  const currentStatus = config?.enabled ? '✅ Włączone' : '❌ Wyłączone';

  const response = await interaction.editReply({
    content: [
      '**📊 Konfiguracja miesięcznych statystyk**',
      '',
      `**Aktualny kanał:** ${currentChannel}`,
      `**Status:** ${currentStatus}`,
      `**Liczba użytkowników:** ${config?.topCount || 10}`,
      '',
      '_Wybierz poniższe opcje, aby zmienić konfigurację:_',
    ].join('\n'),
    components: [channelRow, countRow, statusRow, buttonRow],
  });

  try {
    const collector = response.createMessageComponentCollector({
      filter: (i) => Object.values(CUSTOM_ID).includes(i.customId),
      time: COLLECTION_TIMEOUT,
    });

    let selectedChannelId: string | null = config?.channelId || null;
    let selectedCount: number = config?.topCount || 10;
    let selectedEnabled: boolean = config?.enabled || false;

    collector.on('collect', async (i: MessageComponentInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      await i.deferUpdate();

      if (i.isChannelSelectMenu() && i.customId === CUSTOM_ID.CHANNEL_SELECT) {
        selectedChannelId = i.values[0];
      } else if (i.isStringSelectMenu() && i.customId === CUSTOM_ID.COUNT_SELECT) {
        selectedCount = parseInt(i.values[0]);
      } else if (i.isButton()) {
        if (i.customId === CUSTOM_ID.ENABLE_BUTTON) {
          selectedEnabled = true;
          enableButton.setDisabled(true);
          disableButton.setDisabled(false);
        } else if (i.customId === CUSTOM_ID.DISABLE_BUTTON) {
          selectedEnabled = false;
          enableButton.setDisabled(false);
          disableButton.setDisabled(true);
        } else if (i.customId === CUSTOM_ID.CONFIRM) {
          if (!selectedChannelId) {
            await interaction.editReply({
              content: '⚠️ Musisz wybrać kanał przed zatwierdzeniem!',
              components: [],
            });
            collector.stop();
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

          await MonthlyStatsConfigModel.findOneAndUpdate(
            { guildId: guild.id },
            {
              guildId: guild.id,
              channelId: selectedChannelId,
              enabled: selectedEnabled,
              topCount: selectedCount,
            },
            { upsert: true, new: true }
          );

          const embed = createBaseEmbed({
            title: '📊 Miesięczne statystyki - Konfiguracja zapisana',
            description: 'Konfiguracja została pomyślnie zaktualizowana!',
            footerText: guild.name,
            footerIcon: guild.iconURL() || undefined,
          });

          embed.addFields(
            { name: '📍 Kanał', value: `<#${channel.id}>`, inline: true },
            { name: '📊 Liczba użytkowników', value: `${selectedCount}`, inline: true },
            { name: '⚙️ Status', value: selectedEnabled ? '✅ Włączone' : '❌ Wyłączone', inline: true }
          );

          embed.addFields({
            name: 'ℹ️ Informacje',
            value:
              'Statystyki będą automatycznie wysyłane **1-go dnia miesiąca o 12:00**.\n' +
              'Raport będzie zawierał TOP użytkowników z poprzedniego miesiąca.\n' +
              'Użyj `/config-monthly-stats test` aby zobaczyć przykład.',
          });

          await interaction.editReply({
            content: '',
            embeds: [embed],
            components: [],
          });
          collector.stop();
          return;
        } else if (i.customId === CUSTOM_ID.CANCEL) {
          await interaction.editReply({
            content: 'Konfiguracja anulowana.',
            components: [],
          });
          collector.stop();
          return;
        }

        const updatedChannel = selectedChannelId ? `<#${selectedChannelId}>` : '❌ Nie ustawiono';
        const updatedStatus = selectedEnabled ? '✅ Włączone' : '❌ Wyłączone';

        await interaction.editReply({
          content: [
            '**📊 Konfiguracja miesięcznych statystyk**',
            '',
            `**Wybrany kanał:** ${updatedChannel}`,
            `**Status:** ${updatedStatus}`,
            `**Liczba użytkowników:** ${selectedCount}`,
            '',
            '_Kliknij "Zatwierdź" aby zapisać zmiany._',
          ].join('\n'),
          components: [channelRow, countRow, statusRow, buttonRow],
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⏱️ Czas na konfigurację minął. Spróbuj ponownie.',
          components: [],
        });
      }
    });
  } catch (error) {
    logger.error(`Błąd w interakcji menu konfiguracji: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas konfiguracji.',
      components: [],
    });
  }
}

async function handleRemoveSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const config = await MonthlyStatsConfigModel.findOne({ guildId: guild.id });

  if (!config) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanych statystyk.\nAby skonfigurować, uruchom `/config-monthly-stats set`.'
    );
    return;
  }

  await MonthlyStatsConfigModel.findOneAndDelete({ guildId: guild.id });

  await replyWithSuccess(
    interaction,
    '✅ Usunięto konfigurację miesięcznych statystyk.\nAby skonfigurować ponownie, uruchom `/config-monthly-stats set`.'
  );
}

async function handleShowSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const config = await MonthlyStatsConfigModel.findOne({ guildId: guild.id });

  if (!config || !config.channelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanych statystyk.\nAby skonfigurować, uruchom `/config-monthly-stats set`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(config.channelId);

  if (!channel) {
    await replyWithError(
      interaction,
      '⚠️ Skonfigurowany kanał nie istnieje. Zalecamy ponowną konfigurację.'
    );
    return;
  }

  const embed = createBaseEmbed({
    title: '📊 Konfiguracja miesięcznych statystyk',
    description: 'Aktualna konfiguracja dla tego serwera:',
    footerText: guild.name,
    footerIcon: guild.iconURL() || undefined,
  });

  embed.addFields(
    { name: '📍 Kanał', value: `<#${channel.id}>`, inline: true },
    { name: '📊 Liczba użytkowników', value: `${config.topCount}`, inline: true },
    { name: '⚙️ Status', value: config.enabled ? '✅ Włączone' : '❌ Wyłączone', inline: true }
  );

  embed.addFields({
    name: 'ℹ️ Jak to działa',
    value:
      'Statystyki są zbierane automatycznie:\n' +
      '• Każda wiadomość zwiększa licznik\n' +
      '• Co 30s dodawany jest czas na kanałach głosowych\n\n' +
      'Raport wysyłany jest **1-go dnia miesiąca o 12:00** z danymi z poprzedniego miesiąca.',
  });

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
