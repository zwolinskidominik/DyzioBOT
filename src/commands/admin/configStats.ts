import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  GuildMember,
  VoiceChannel,
  Guild,
  MessageFlags,
} from 'discord.js';
import { ChannelStatsModel } from '../../models/ChannelStats';
import type { IChannelStats, IChannelsConfig, IChannelInfo } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

type StatType = 'lastJoined' | 'users' | 'bots' | 'bans';

const STAT_TYPES: Record<StatType, string> = {
  lastJoined: 'Ostatnia osoba',
  users: 'Liczba użytkowników',
  bots: 'Liczba botów',
  bans: 'Liczba banów',
};

export const data = new SlashCommandBuilder()
  .setName('config-statystyki')
  .setDescription(
    'Tworzy kanał statystyk serwera (ostatnia osoba, liczba użytkowników, botów, banów)'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName('rodzaj')
      .setDescription('Wybierz typ kanału statystyk')
      .setRequired(true)
      .addChoices(...Object.entries(STAT_TYPES).map(([value, name]) => ({ name, value })))
  )
  .addStringOption((option) =>
    option
      .setName('nazwa-kanalu')
      .setDescription('Nazwa kanału (użyj "<>" jako placeholder, np. "<> osób")')
      .setRequired(true)
  );

export const options = { deleted: true };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({
        content: 'Ta komenda może być użyta tylko na serwerze.',
      });
      return;
    }

    const type = interaction.options.getString('rodzaj', true) as StatType;
    const template = interaction.options.getString('nazwa-kanalu', true);

    if (!template.includes('<>')) {
      await interaction.editReply({
        content: '❌ Nazwa kanału musi zawierać placeholder "<>"!',
      });
      return;
    }

    const value = await getStatValue(type, guild);

    const newChannel = (await guild.channels.create({
      name: template.replace(/<>/g, value),
      type: ChannelType.GuildVoice,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }],
    })) as VoiceChannel;

    const existing = await ChannelStatsModel.findOne({ guildId: guild.id })
      .lean<IChannelStats>()
      .exec();

    const channelsConfig: IChannelsConfig = existing?.channels ?? {};

    const channelInfo: IChannelInfo = {
      channelId: newChannel.id,
      template,
      ...(type === 'lastJoined' && { member: getNewestMember(guild)?.id }),
    };

    await ChannelStatsModel.updateOne(
      { guildId: guild.id },
      { $set: { channels: { ...channelsConfig, [type]: channelInfo } } },
      { upsert: true }
    );

    const embed = createBaseEmbed({
      title: 'Kanał statystyk utworzony!',
      description: `Utworzono kanał **${newChannel.name}** dla statystyk: ${STAT_TYPES[type]}.`,
      footerText: interaction.user.tag,
      footerIcon: interaction.user.displayAvatarURL(),
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas tworzenia kanału statystyk: ${error}`);
    await interaction.editReply({
      content: 'Wystąpił błąd podczas tworzenia kanału statystyk.',
    });
  }
}

const getNewestMember = (guild: Guild): GuildMember | undefined => {
  return guild.members.cache
    .filter((member) => !member.user.bot)
    .sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0))
    .first();
};

const getStatValue = async (type: StatType, guild: Guild): Promise<string> => {
  try {
    switch (type) {
      case 'users':
        return guild.members.cache.filter((m) => !m.user.bot).size.toString();
      case 'bots':
        return guild.members.cache.filter((m) => m.user.bot).size.toString();
      case 'bans':
        try {
          const bans = await guild.bans.fetch();
          return bans.size.toString();
        } catch (error) {
          logger.error(`Błąd przy pobieraniu banów: ${error}`);
          return '0';
        }
      case 'lastJoined':
        const newest = getNewestMember(guild);
        return newest?.user.username ?? 'Brak';
      default:
        return '0';
    }
  } catch (error) {
    logger.error(`Błąd podczas pobierania statystyk ${type}: ${error}`);
    return '0';
  }
};
