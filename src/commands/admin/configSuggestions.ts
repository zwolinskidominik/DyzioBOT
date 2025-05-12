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
import { SuggestionConfigurationModel } from '../../models/SuggestionConfiguration';
import type { ISuggestionConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'suggestions-channel-select',
  CONFIRM: 'suggestions-confirm',
  CANCEL: 'suggestions-cancel',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-suggestions')
  .setDescription('Skonfiguruj kanał sugestii.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName('setup').setDescription('Konfiguruje kanał sugestii.')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('clear').setDescription('Usuwa kanał sugestii.')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('show').setDescription('Wyświetla aktualnie skonfigurowany kanał sugestii')
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
    logger.error(`Błąd podczas konfiguracji kanału sugestii: ${error}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału sugestii.');
  }
}

async function handleSetupSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał sugestii')
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
    content: 'Wybierz kanał, na którym będą publikowane sugestie użytkowników:',
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

          await saveSuggestionChannel(guild.id, channel.id);

          const embed = createBaseEmbed({
            title: '💡 Konfiguracja kanału sugestii',
            description: `Kanał sugestii został skonfigurowany!`,
            footerText: guild?.name || '',
            footerIcon: guild?.iconURL() || undefined,
          });

          embed.addFields({
            name: 'Kanał sugestii',
            value: `<#${channel.id}>`,
          });

          embed.addFields({
            name: 'Jak to działa',
            value:
              'Wiadomości wysłane na kanał sugestii zostaną automatycznie przekształcone w sugestie z przyciskami do głosowania i dedykowanym wątkiem do dyskusji.',
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

async function saveSuggestionChannel(guildId: string, channelId: string): Promise<void> {
  try {
    await SuggestionConfigurationModel.findOneAndUpdate(
      { guildId },
      { guildId, suggestionChannelId: channelId },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error(`Błąd podczas zapisywania kanału sugestii: ${error}`);
    throw error;
  }
}

async function handleClearSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await SuggestionConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<ISuggestionConfiguration>()
    .exec();

  if (!existingConfig) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału sugestii.\nAby skonfigurować, uruchom `/config-suggestions setup`.'
    );
    return;
  }

  await SuggestionConfigurationModel.findOneAndDelete({ guildId: guild.id });

  await replyWithSuccess(
    interaction,
    'Usunięto kanał sugestii.\nAby skonfigurować ponownie, uruchom `/config-suggestions setup`.'
  );
}

async function handleShowSubcommand(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const existingConfig = await SuggestionConfigurationModel.findOne({
    guildId: guild.id,
  })
    .lean<ISuggestionConfiguration>()
    .exec();

  if (!existingConfig || !existingConfig.suggestionChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału sugestii.\nAby skonfigurować, uruchom `/config-suggestions setup`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(existingConfig.suggestionChannelId) as GuildBasedChannel;

  if (!channel) {
    await replyWithError(
      interaction,
      'Skonfigurowany kanał sugestii nie istnieje. Zalecamy ponowną konfigurację.'
    );
    return;
  }

  const embed = createBaseEmbed({
    title: '💡 Konfiguracja kanału sugestii',
    description: 'Aktualna konfiguracja kanału sugestii dla tego serwera:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Kanał sugestii',
    value: `<#${channel.id}>`,
  });

  embed.addFields({
    name: 'Jak to działa',
    value:
      'Wiadomości wysłane na kanał sugestii zostaną automatycznie przekształcone w sugestie z przyciskami do głosowania i dedykowanym wątkiem do dyskusji.',
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
