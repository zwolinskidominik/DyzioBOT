import { HangmanStatsModel, HangmanStatsDocument } from '../models/HangmanStats';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

export interface HangmanStatsEntry {
  userId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  winRate: number;    // 0–100
  avgGuesses: number; // średnia liter na grę
}

export interface HangmanLeaderboardData {
  entries: HangmanStatsEntry[];
  page: number;
  totalPages: number;
  totalPlayers: number;
}

/**
 * Record the result of a finished hangman game for a given guild + user.
 * Automatically upserts and recalculates streak counters.
 */
export async function recordGame(
  guildId: string,
  userId: string,
  params: {
    won: boolean;
    wrongGuesses: number;
    totalLetters: number;
  },
): Promise<ServiceResult<HangmanStatsDocument>> {
  try {
    let stats = await HangmanStatsModel.findOne({ guildId, userId });

    if (!stats) {
      stats = new HangmanStatsModel({
        guildId,
        userId,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalWrongGuesses: 0,
        totalLettersGuessed: 0,
      });
    }

    stats.gamesPlayed += 1;
    stats.totalWrongGuesses += params.wrongGuesses;
    stats.totalLettersGuessed += params.totalLetters;

    if (params.won) {
      stats.wins += 1;
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else {
      stats.losses += 1;
      stats.currentStreak = 0;
    }

    await stats.save();
    return ok(stats);
  } catch (error) {
    logger.error(`[HangmanStats] Failed to record game for user ${userId} in guild ${guildId}: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zapisać statystyk gry.');
  }
}

/**
 * Fetch the hangman leaderboard for a guild.
 * Sorted by wins (descending), then by win rate (descending).
 */
export async function getLeaderboard(
  guildId: string,
  page = 1,
  perPage = 10,
): Promise<ServiceResult<HangmanLeaderboardData>> {
  try {
    const totalPlayers = await HangmanStatsModel.countDocuments({ guildId });

    if (totalPlayers === 0) {
      return fail('NO_PLAYERS', 'Nikt jeszcze nie grał w Wisielca na tym serwerze.');
    }

    const totalPages = Math.ceil(totalPlayers / perPage);
    const safePage = Math.min(page, totalPages);

    const raw = await HangmanStatsModel.find({ guildId })
      .sort({ wins: -1, losses: 1 })
      .skip((safePage - 1) * perPage)
      .limit(perPage)
      .lean();

    const entries: HangmanStatsEntry[] = raw.map((s) => {
      const gamesPlayed = s.gamesPlayed || 0;
      const wins = s.wins || 0;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
      const totalGuesses = s.totalLettersGuessed || 0;
      const avgGuesses = gamesPlayed > 0 ? Math.round((totalGuesses / gamesPlayed) * 10) / 10 : 0;

      return {
        userId: s.userId,
        gamesPlayed,
        wins,
        losses: s.losses || 0,
        currentStreak: s.currentStreak || 0,
        bestStreak: s.bestStreak || 0,
        winRate,
        avgGuesses,
      };
    });

    return ok({
      entries,
      page: safePage,
      totalPages,
      totalPlayers,
    });
  } catch (error) {
    logger.error(`[HangmanStats] Failed to fetch leaderboard for guild ${guildId}: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać rankingu.');
  }
}
