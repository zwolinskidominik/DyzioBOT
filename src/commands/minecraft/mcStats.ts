import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { ICommandConfig, ICommandOptions } from '../../interfaces/Command';
import { getMinecraftConfig } from '../../config/minecraft';
import { getMinecraftRuntime } from '../../services/minecraft/runtime';
import { MINECRAFT_NICK } from '../../services/minecraft/rconClient';
import { findPlayer, formatPlayTime, linkedNick, rankPlayers, type StatsResult } from '../../services/minecraft/statsService';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

/** Statystyki jednego gracza GameZone MC (czas gry, śmierci, miejsce w rankingu). Tylko GameZone. */
export const data = new SlashCommandBuilder()
  .setName('mc-stats')
  .setDescription('Minecraft stats of a GameZone player ⛏️')
  .setDescriptionLocalizations({ pl: 'Statystyki gracza z serwera Minecraft GameZone ⛏️' })
  .addUserOption((o) =>
    o
      .setName('user')
      .setDescription('Discord user from the whitelist (defaults to you)')
      .setDescriptionLocalizations({ pl: 'Osoba z whitelisty (domyślnie Ty)' })
      .setRequired(false)
  )
  .addStringOption((o) =>
    o
      .setName('nick')
      .setDescription('Minecraft nickname (instead of a Discord user)')
      .setDescriptionLocalizations({ pl: 'Nick z Minecrafta (zamiast osoby z Discorda)' })
      .setMinLength(3)
      .setMaxLength(16)
      .setRequired(false)
  )
  .setDMPermission(false);

const mcConfig = getMinecraftConfig();
export const options: ICommandConfig = mcConfig
  ? { cooldown: 5, guildOnly: true, restrictedGuildIds: [mcConfig.guildId] }
  : { deleted: true };

/** Wspólny komunikat, gdy statystyki są niedostępne (też dla /mc-top). */
export function statsUnavailableText(result: Extract<StatsResult, { ok: false }>): string {
  return result.reason === 'not_ready'
    ? 'Statystyki serwera nie są jeszcze dostępne.'
    : 'Nie udało się pobrać statystyk, spróbuj za chwilę.';
}

export function staleNote(updatedAt: Date | null, stale: boolean): string {
  const when = updatedAt ? `<t:${Math.floor(updatedAt.getTime() / 1000)}:R>` : 'nieznany';
  return `Stan statystyk: ${when}${stale ? ' (ostatnie zapisane dane)' : ''}`;
}

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const rt = getMinecraftRuntime();
  if (!rt || interaction.guildId !== rt.config.guildId) {
    await interaction.reply({ embeds: [createErrorEmbed('Ta komenda nie działa na tym serwerze.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const nickOption = interaction.options.getString('nick');
  if (nickOption !== null && !MINECRAFT_NICK.test(nickOption)) {
    await interaction.reply({ embeds: [createErrorEmbed('Nick: 3-16 znaków, litery, cyfry i _.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();
  try {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const nick = nickOption ?? (await linkedNick(rt.config.guildId, user.id));
    if (!nick) {
      await interaction.editReply({
        embeds: [createErrorEmbed(`<@${user.id}> nie jest na whiteliście. Podaj nick z Minecrafta w opcji \`nick\`.`)],
        allowedMentions: { parse: [] },
      });
      return;
    }

    const result = await rt.stats.get();
    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(statsUnavailableText(result))] });
      return;
    }
    const player = findPlayer(result.data.players, nick);
    if (!player) {
      await interaction.editReply({
        embeds: [createErrorEmbed(`Brak statystyk gracza **${nick.replace(/_/g, '\\_')}** - pewnie jeszcze nie grał na serwerze.`)],
      });
      return;
    }

    const place = (metric: 'playtime' | 'deaths') =>
      rankPlayers(result.data.players, metric).findIndex((p) => p.uuid === player.uuid) + 1;
    const total = result.data.players.length;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`⛏️ ${player.name.replace(/_/g, '\\_')}`)
      .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/64`)
      .addFields(
        { name: '⏱️ Czas gry', value: `${formatPlayTime(player.playTime)}\nmiejsce ${place('playtime')}/${total}`, inline: true },
        { name: '💀 Śmierci', value: `${player.deaths}\nmiejsce ${place('deaths')}/${total}`, inline: true }
      )
      .setFooter({ text: 'GameZone MC' })
      .setDescription(staleNote(result.data.updatedAt, result.data.stale));
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    logger.error(`[MC] /mc-stats nie powiodło się: ${err}`);
    await interaction.editReply({ embeds: [createErrorEmbed('Coś poszło nie tak. Spróbuj za chwilę.')] }).catch(() => undefined);
  }
}
