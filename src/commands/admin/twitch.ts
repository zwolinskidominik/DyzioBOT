import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  User,
  MessageFlags,
  ChatInputCommandInteraction,
  Guild,
} from 'discord.js';
import { TwitchStreamerModel, TwitchStreamerDocument } from '../../models/TwitchStreamer';
import type { ITwitchStreamer } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('twitch')
  .setDescription('Zarządzaj listą ogłaszanych streamerów Twitcha.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Dodaje streamerów Twitcha powiązanych z użytkownikiem Discord.')
      .addStringOption((option) =>
        option
          .setName('twitch-username')
          .setDescription('Nazwa użytkownika na Twitchu.')
          .setRequired(true)
      )
      .addUserOption((option) =>
        option
          .setName('discord-user')
          .setDescription('Użytkownik Discord powiązany ze streamerem.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Wyświetla listę streamerów Twitcha na tym serwerze.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Usuwa streamera Twitcha z listy.')
      .addStringOption((option) =>
        option
          .setName('twitch-username')
          .setDescription('Nazwa użytkownika na Twitchu.')
          .setRequired(true)
      )
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({
      content: 'Ta komenda może być użyta tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (subcommand) {
    case 'add':
      await handleAddStreamer(interaction, guild);
      break;
    case 'list':
      await handleListStreamers(interaction, guild);
      break;
    case 'remove':
      await handleRemoveStreamer(interaction, guild);
      break;
  }
}

async function handleAddStreamer(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const twitchChannel = interaction.options.getString('twitch-username', true);
  const discordUser = interaction.options.getUser('discord-user', true) as User;
  const userId = discordUser.id;

  if (!twitchChannel) {
    await interaction.reply({
      content: 'Nie podano nazwy użytkownika Twitch.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.deferReply();

    let streamer = (await TwitchStreamerModel.findOne({
      guildId: guild.id,
      userId,
    }).exec()) as TwitchStreamerDocument;

    if (!streamer) {
      streamer = new TwitchStreamerModel({
        guildId: guild.id,
        twitchChannel,
        userId,
        isLive: false,
        active: true,
      });
    } else {
      streamer.twitchChannel = twitchChannel;
      streamer.active = true;
    }

    await streamer.save();

    const successEmbed = createBaseEmbed({
      title: '🎮 Dodano streamera Twitch',
      description: `Streamer ${twitchChannel} powiązany z użytkownikiem <@${userId}> został ${streamer ? 'zaktualizowany' : 'dodany'}.`,
      color: COLORS.TWITCH,
      footerText: guild?.name || '',
      footerIcon: guild?.iconURL() || undefined,
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas zapisywania streamera: ${error}`);

    const errorEmbed = createBaseEmbed({
      isError: true,
      description: 'Wystąpił błąd podczas zapisywania streamera.',
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleListStreamers(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  try {
    await interaction.deferReply();

    const streamers = await TwitchStreamerModel.find({
      guildId: guild.id,
      active: true,
    })
      .lean<ITwitchStreamer[]>()
      .exec();

    if (!streamers.length) {
      const notFoundEmbed = createBaseEmbed({
        title: '🎮 Lista streamerów Twitch',
        description: 'Nie znaleziono żadnych streamerów dla tego serwera.',
        color: COLORS.TWITCH,
        footerText: guild?.name || '',
        footerIcon: guild?.iconURL() || undefined,
      });

      await interaction.editReply({ embeds: [notFoundEmbed] });
      return;
    }

    const streamerList = streamers
      .map(
        (streamer: ITwitchStreamer, index: number) =>
          `${index + 1}. **${streamer.twitchChannel}** (Użytkownik: <@${streamer.userId}>)`
      )
      .join('\n');

    const listEmbed = createBaseEmbed({
      title: '🎮 Lista streamerów Twitch',
      description: streamerList,
      footerText: `Znaleziono ${streamers.length} streamerów`,
      color: COLORS.TWITCH,
    });

    await interaction.editReply({ embeds: [listEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas pobierania listy streamerów: ${error}`);

    const errorEmbed = createBaseEmbed({
      isError: true,
      description: 'Wystąpił błąd podczas pobierania listy streamerów.',
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemoveStreamer(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const twitchChannel = interaction.options.getString('twitch-username', true);

  if (!twitchChannel) {
    await interaction.reply({
      content: 'Nie podano nazwy użytkownika Twitch.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.deferReply();

    const streamer = await TwitchStreamerModel.findOne({
      guildId: guild.id,
      twitchChannel,
    }).exec();

    if (!streamer) {
      const notFoundEmbed = createBaseEmbed({
        isError: true,
        title: '🎮 Usuwanie streamera',
        description: `Streamer **${twitchChannel}** nie został znaleziony w bazie danych.`,
        color: COLORS.TWITCH,
      });

      await interaction.editReply({ embeds: [notFoundEmbed] });
      return;
    }

    await TwitchStreamerModel.deleteOne({ guildId: guild.id, twitchChannel }).exec();

    const successEmbed = createBaseEmbed({
      title: '🎮 Usunięto streamera',
      description: `Streamer **${twitchChannel}** został usunięty z listy.`,
      color: COLORS.TWITCH,
      footerText: guild?.name || '',
      footerIcon: guild?.iconURL() || undefined,
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas usuwania streamera: ${error}`);

    const errorEmbed = createBaseEmbed({
      isError: true,
      description: 'Wystąpił błąd podczas usuwania streamera.',
    });

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
