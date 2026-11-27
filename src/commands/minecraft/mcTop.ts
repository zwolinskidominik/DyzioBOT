import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { ICommandConfig, ICommandOptions } from '../../interfaces/Command';
import { getMinecraftConfig } from '../../config/minecraft';
import { getMinecraftRuntime } from '../../services/minecraft/runtime';
import { formatPlayTime, rankPlayers, userIdsByNick, type StatsMetric } from '../../services/minecraft/statsService';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';
import { staleNote, statsUnavailableText } from './mcStats';

/** Topka graczy GameZone MC: czas gry albo śmierci. Tylko GameZone. */
export const TOP_SIZE = 10;

export const data = new SlashCommandBuilder()
  .setName('mc-top')
  .setDescription('Top GameZone Minecraft players 🏆')
  .setDescriptionLocalizations({ pl: 'Topka graczy serwera Minecraft GameZone 🏆' })
  .addStringOption((o) =>
    o
      .setName('type')
      .setDescription('Ranking type (defaults to playtime)')
      .setDescriptionLocalizations({ pl: 'Rodzaj rankingu (domyślnie czas gry)' })
      .setRequired(false)
      .addChoices(
        { name: '⏱️ Playtime', name_localizations: { pl: '⏱️ Czas gry' }, value: 'playtime' },
        { name: '💀 Deaths', name_localizations: { pl: '💀 Śmierci' }, value: 'deaths' }
      )
  )
  .setDMPermission(false);

const mcConfig = getMinecraftConfig();
export const options: ICommandConfig = mcConfig
  ? { cooldown: 5, guildOnly: true, restrictedGuildIds: [mcConfig.guildId] }
  : { deleted: true };

const MEDALS = ['🥇', '🥈', '🥉'];

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const rt = getMinecraftRuntime();
  if (!rt || interaction.guildId !== rt.config.guildId) {
    await interaction.reply({ embeds: [createErrorEmbed('Ta komenda nie działa na tym serwerze.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const metric: StatsMetric = interaction.options.getString('type') === 'deaths' ? 'deaths' : 'playtime';

  await interaction.deferReply();
  try {
    const result = await rt.stats.get();
    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(statsUnavailableText(result))] });
      return;
    }
    const ranked = rankPlayers(result.data.players, metric)
      .filter((p) => (metric === 'playtime' ? p.playTime > 0 : p.deaths > 0))
      .slice(0, TOP_SIZE);
    if (ranked.length === 0) {
      await interaction.editReply({ embeds: [createErrorEmbed('Brak danych do rankingu.')] });
      return;
    }

    const discordIds = await userIdsByNick(rt.config.guildId);
    const lines = ranked.map((p, i) => {
      const place = MEDALS[i] ?? `\`${i + 1}.\``;
      const value = metric === 'playtime' ? formatPlayTime(p.playTime) : `${p.deaths}`;
      const who = discordIds.get(p.name.toLowerCase());
      const name = `**${p.name.replace(/_/g, '\\_')}**${who ? ` (<@${who}>)` : ''}`;
      return `${place} ${name} - ${value}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(metric === 'playtime' ? '🏆 Najdłużej grający' : '💀 Najwięcej śmierci')
      .setDescription(`${lines.join('\n')}\n\n${staleNote(result.data.updatedAt, result.data.stale)}`)
      .setFooter({ text: 'GameZone MC' });
    // Wzmianki w embedzie i tak nikogo nie pingują, ale dla pewności bez powiadomień.
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    logger.error(`[MC] /mc-top nie powiodło się: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Coś poszło nie tak. Spróbuj za chwilę.')] }).catch(() => undefined);
  }
}
