import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  VoiceChannel,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { TempChannelConfigurationModel } from '../../models/TempChannelConfiguration';
import type { ITempChannelConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('temp-channel')
  .setDescription('Zarządza kanałami tymczasowymi.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Dodaje kanał do nasłuchiwania.')
      .addChannelOption((option) =>
        option
          .setName('kanal')
          .setDescription('Kanał głosowy, który chcesz dodać do nasłuchiwania.')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildVoice)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Wyświetla listę kanałów, które są monitorowane.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Usuwa kanał głosowy z monitorowanych.')
      .addChannelOption((option) =>
        option
          .setName('kanal')
          .setDescription('Kanał głosowy, który chcesz usunąć z nasłuchiwania.')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildVoice)
      )
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({
      content: 'Komenda może być użyta tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleAddSubcommand(interaction, guildId);
      break;

    case 'list':
      await handleListSubcommand(interaction, guildId);
      break;

    case 'remove':
      await handleRemoveSubcommand(interaction, guildId);
      break;

    default:
      await interaction.reply({
        content: 'Nieznana podkomenda.',
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleAddSubcommand(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const channel = interaction.options.getChannel('kanal') as VoiceChannel;

  try {
    let config = await TempChannelConfigurationModel.findOne({ guildId }).exec();

    if (config && config.channelIds.includes(channel.id)) {
      await interaction.reply({
        content: 'Ten kanał jest już dodany do nasłuchiwania.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!config) {
      config = new TempChannelConfigurationModel({
        guildId,
        channelIds: [channel.id],
      });
    } else {
      config.channelIds.push(channel.id);
    }
    await config.save();

    await interaction.reply({
      content: `Kanał ${channel.name} został dodany do nasłuchiwania.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Błąd przy dodawaniu kanału do nasłuchiwania (channelId=${channel.id}): ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas dodawania kanału.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleListSubcommand(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  try {
    const config = await TempChannelConfigurationModel.findOne({ guildId })
      .lean()
      .exec() as ITempChannelConfiguration | null;

    if (!config || config.channelIds.length === 0) {
      await interaction.reply({
        content: 'Brak monitorowanych kanałów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed: EmbedBuilder = createBaseEmbed({
      title: 'Monitorowane kanały',
      description: 'Lista kanałów, które są używane do tworzenia kanałów tymczasowych:',
    });

    config.channelIds.forEach((channelId, index) => {
      const channel = interaction.guild?.channels.cache.get(channelId);
      embed.addFields({
        name: `Kanał #${index + 1}`,
        value: channel
          ? `${channel.name} (${channel.id})`
          : `ID: ${channelId} (niedostępny)`,
        inline: true,
      });
    });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error(`Błąd przy wyświetlaniu listy kanałów w guildId=${guildId}: ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas wyświetlania listy kanałów.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleRemoveSubcommand(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const channel = interaction.options.getChannel('kanal') as VoiceChannel;

  try {
    const config = await TempChannelConfigurationModel.findOne({ guildId }).exec();

    if (!config || !config.channelIds.includes(channel.id)) {
      await interaction.reply({
        content: 'Ten kanał nie był monitorowany.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    config.channelIds = config.channelIds.filter(id => id !== channel.id);
    await config.save();

    await interaction.reply({
      content: `Kanał ${channel.name} został usunięty z nasłuchiwania.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Błąd przy usuwaniu kanału z nasłuchiwania (channelId=${channel.id}): ${error}`);
    await interaction.reply({
      content: 'Wystąpił błąd podczas usuwania kanału.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
