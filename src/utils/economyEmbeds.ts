import { EmbedBuilder, User } from 'discord.js';
import { COLORS } from '../config/constants/colors';
import { WalletData, LeaderboardData, LeaderboardMode, CurrencyConfig } from '../services/economyService';

/** Formatuje liczbę ze spacją jako separatorem tysięcy (styl PL). */
export function fmtNum(n: number): string {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Formatuje kwotę z symbolem waluty. */
export function fmtCoin(n: number, symbol: string): string {
  return `${fmtNum(n)} ${symbol}`;
}

const MODE_LABELS: Record<LeaderboardMode, string> = {
  wealth: '💰 Bogactwo (Net Worth)',
  wallet: '👛 Portfel',
  bank: '🏦 Bank',
  earned: '📈 Zarobione łącznie',
  gambling: '🎲 Wygrane w grach',
};

const MODE_VALUE: Record<LeaderboardMode, (e: LeaderboardData['entries'][number]) => number> = {
  wealth: (e) => e.netWorth,
  wallet: (e) => e.wallet,
  bank: (e) => e.bank,
  earned: (e) => e.totalEarned,
  gambling: (e) => e.totalWon,
};

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/* ─── Balance embed ─────────────────────────────────────────────── */

export function createBalanceEmbed(
  user: User,
  data: WalletData,
  cfg: CurrencyConfig,
  rank: number,
): EmbedBuilder {
  const { currencySymbol: sym } = cfg;
  const rankLabel = rank > 0 ? `#${rank}` : '—';

  return new EmbedBuilder()
    .setColor(0x22c358)
    .setAuthor({
      name: `${user.displayName} — profil`,
      iconURL: user.displayAvatarURL({ size: 64 }),
    })
    .addFields(
      { name: '👛 Portfel', value: fmtCoin(data.wallet, sym), inline: true },
      { name: '🏦 Bank', value: fmtCoin(data.bank, sym), inline: true },
      { name: '💰 Net Worth', value: fmtCoin(data.netWorth, sym), inline: true },
      { name: '​', value: '​', inline: false },
      { name: '📊 Poziom ekonomiczny', value: `**${data.economyLevel}**`, inline: true },
      { name: '📅 Streak dzienny', value: `**${data.dailyStreak}** dni`, inline: true },
      { name: '🏆 Ranking', value: `**${rankLabel}**`, inline: true },
    );
}

/* ─── Deposit / Withdraw embed ──────────────────────────────────── */

export function createDepositEmbed(
  transferred: number,
  wallet: number,
  bank: number,
  sym: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ECONOMY)
    .setTitle('🏦 Wpłata do banku')
    .setDescription(`Przelano **${fmtCoin(transferred, sym)}** z portfela do banku.`)
    .addFields(
      { name: '👛 Portfel', value: fmtCoin(wallet, sym), inline: true },
      { name: '🏦 Bank', value: fmtCoin(bank, sym), inline: true },
    )
    .setTimestamp();
}

export function createWithdrawEmbed(
  transferred: number,
  wallet: number,
  bank: number,
  sym: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ECONOMY)
    .setTitle('👛 Wypłata z banku')
    .setDescription(`Wypłacono **${fmtCoin(transferred, sym)}** z banku do portfela.`)
    .addFields(
      { name: '👛 Portfel', value: fmtCoin(wallet, sym), inline: true },
      { name: '🏦 Bank', value: fmtCoin(bank, sym), inline: true },
    )
    .setTimestamp();
}

/* ─── Send embed ────────────────────────────────────────────────── */

export function createSendEmbed(
  sender: User,
  receiver: User,
  amount: number,
  senderWallet: number,
  sym: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ECONOMY_WIN)
    .setTitle('💸 Przelew')
    .setDescription(
      `**${sender.displayName}** wysłał **${fmtCoin(amount, sym)}** do **${receiver.displayName}**.`,
    )
    .addFields({ name: '👛 Twój portfel po przelewie', value: fmtCoin(senderWallet, sym), inline: true })
    .setTimestamp();
}

/* ─── Leaderboard embed ─────────────────────────────────────────── */

export function createLeaderboardEmbed(
  data: LeaderboardData,
  mode: LeaderboardMode,
  page: number,
  totalPages: number,
  sym: string,
): EmbedBuilder {
  const getValue = MODE_VALUE[mode];

  const rows = data.entries.map((e) => {
    const medal = RANK_MEDALS[e.rank] ?? `**${e.rank}.**`;
    const value = fmtCoin(getValue(e), sym);
    return `${medal} <@${e.userId}> — ${value}`;
  });

  const description = rows.length > 0 ? rows.join('\n') : '_Brak użytkowników._';

  return new EmbedBuilder()
    .setColor(COLORS.ECONOMY)
    .setTitle(`🏆 Ranking — ${MODE_LABELS[mode]}`)
    .setDescription(description)
    .setFooter({
      text: `Strona ${page}/${totalPages} · ${data.totalUsers} użytkowników`,
    })
    .setTimestamp();
}
