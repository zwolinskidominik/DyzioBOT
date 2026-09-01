import mongoose from 'mongoose';
import { EconomyModel, EconomyDocument } from '../models/Economy';
import { EconomyTransactionModel, TransactionType } from '../models/EconomyTransaction';
import { EconomyConfigModel } from '../models/EconomyConfig';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/* ── Typy publiczne ────────────────────────────────────────────── */

export interface WalletData {
  wallet: number;
  bank: number;
  netWorth: number;
  totalEarned: number;
  totalSpent: number;
  totalWon: number;
  totalLost: number;
  economyLevel: number;
  dailyStreak: number;
}

export interface CurrencyConfig {
  currencyName: string;
  currencySymbol: string;
  currencyPlural: string;
}

export interface LeaderboardEntry {
  userId: string;
  wallet: number;
  bank: number;
  netWorth: number;
  totalEarned: number;
  totalWon: number;
  rank: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  totalUsers: number;
}

export interface TransferResult {
  senderWallet: number;
  senderBank: number;
  receiverWallet: number;
}

export interface HistoryEntry {
  type: TransactionType;
  amount: number;
  walletAfter: number;
  bankAfter: number;
  targetUserId: string | undefined;
  createdAt: Date;
}

export type LeaderboardMode = 'wealth' | 'wallet' | 'bank' | 'earned' | 'gambling';

/* ── Parametry wewnętrzne ──────────────────────────────────────── */

interface AtomicUpdateParams {
  guildId: string;
  userId: string;
  type: TransactionType;
  walletDelta: number;
  bankDelta: number;
  /** Zmiana netWorth. Dla deposit/withdraw = 0 (wewnętrzny transfer). */
  netWorthDelta: number;
  earnedDelta?: number;
  spentDelta?: number;
  wonDelta?: number;
  lostDelta?: number;
  targetUserId?: string;
  meta?: Record<string, unknown>;
}

/* ── Helpers wewnętrzne ────────────────────────────────────────── */

/** Czy moduł ekonomii jest włączony dla gildii (domyślnie: tak, dopóki admin go nie wyłączy). */
async function isEconomyEnabled(guildId: string): Promise<boolean> {
  const config = await EconomyConfigModel.findOne({ guildId }).lean();
  return config?.enabled !== false;
}

/** Atomowy update + zapis do ledgera. Nigdy nie aktualizuj salda bezpośrednio. */
async function atomicUpdate(params: AtomicUpdateParams): Promise<EconomyDocument> {
  const inc: Record<string, number> = {
    wallet: params.walletDelta,
    bank: params.bankDelta,
    netWorth: params.netWorthDelta,
  };
  if (params.earnedDelta !== undefined && params.earnedDelta !== 0) {
    inc['totalEarned'] = params.earnedDelta;
  }
  if (params.spentDelta !== undefined && params.spentDelta !== 0) {
    inc['totalSpent'] = params.spentDelta;
  }
  if (params.wonDelta !== undefined && params.wonDelta !== 0) {
    inc['totalWon'] = params.wonDelta;
  }
  if (params.lostDelta !== undefined && params.lostDelta !== 0) {
    inc['totalLost'] = params.lostDelta;
  }

  const updated = await EconomyModel.findOneAndUpdate(
    { guildId: params.guildId, userId: params.userId },
    { $inc: inc, $set: { lastActivityAt: new Date() } },
    { new: true, upsert: true },
  );

  await EconomyTransactionModel.create({
    guildId: params.guildId,
    userId: params.userId,
    type: params.type,
    amount: params.walletDelta + params.bankDelta,
    walletAfter: updated.wallet,
    bankAfter: updated.bank,
    targetUserId: params.targetUserId,
    meta: params.meta,
  });

  return updated;
}

/* ── Publiczne API serwisu ─────────────────────────────────────── */

/**
 * Pobierz lub stwórz konto użytkownika.
 * Saldo startowe pochodzi z konfiguracji gildii.
 */
export async function getOrCreateWallet(guildId: string, userId: string): Promise<EconomyDocument> {
  const config = await EconomyConfigModel.findOne({ guildId }).lean();
  const startingBalance = config?.startingBalance ?? 0;

  return EconomyModel.findOneAndUpdate(
    { guildId, userId },
    { $setOnInsert: { guildId, userId, wallet: startingBalance, bank: 0, lastActivityAt: new Date() } },
    { upsert: true, new: true },
  );
}

/** Pobierz konfigurację waluty gildii (domyślna jeśli brak). */
export async function getCurrencyConfig(guildId: string): Promise<CurrencyConfig> {
  const config = await EconomyConfigModel.findOne({ guildId }).lean();
  return {
    currencyName: config?.currencyName ?? 'GameCoins',
    currencySymbol: config?.currencySymbol ?? '🪙',
    currencyPlural: config?.currencyPlural ?? 'GameCoinów',
  };
}

/** Pobierz saldo i statystyki użytkownika. */
export async function getBalance(
  guildId: string,
  userId: string,
): Promise<ServiceResult<WalletData>> {
  try {
    if (!(await isEconomyEnabled(guildId))) {
      return fail('DISABLED', 'System ekonomii jest wyłączony na tym serwerze.');
    }

    const doc = await getOrCreateWallet(guildId, userId);
    return ok({
      wallet: doc.wallet,
      bank: doc.bank,
      netWorth: doc.netWorth,
      totalEarned: doc.totalEarned,
      totalSpent: doc.totalSpent,
      totalWon: doc.totalWon,
      totalLost: doc.totalLost,
      economyLevel: doc.economyLevel,
      dailyStreak: doc.dailyStreak,
    });
  } catch (err) {
    logger.error('economyService.getBalance failed', { guildId, userId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się pobrać salda.');
  }
}

/** Pozycja rankingowa użytkownika według net worth. */
export async function getUserRank(guildId: string, userId: string): Promise<ServiceResult<number>> {
  try {
    const doc = await EconomyModel.findOne({ guildId, userId }).lean();
    if (!doc) return ok(0);
    // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje ręcznie pisane
    // operatory — bez tego /rank rzuca CastError.
    const rank =
      (await EconomyModel.countDocuments({ guildId, netWorth: mongoose.trusted({ $gt: doc.netWorth }) })) + 1;
    return ok(rank);
  } catch (err) {
    logger.error('economyService.getUserRank failed', { guildId, userId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się pobrać rankingu.');
  }
}

/**
 * Wpłać do banku (Portfel → Bank).
 * Nie zmienia netWorth — to transfer wewnętrzny.
 */
export async function deposit(
  guildId: string,
  userId: string,
  amount: number | 'all',
): Promise<ServiceResult<{ wallet: number; bank: number; transferred: number }>> {
  try {
    if (!(await isEconomyEnabled(guildId))) {
      return fail('DISABLED', 'System ekonomii jest wyłączony na tym serwerze.');
    }

    const doc = await getOrCreateWallet(guildId, userId);
    const transferred = amount === 'all' ? doc.wallet : amount;

    if (transferred <= 0) {
      return fail('INVALID_AMOUNT', 'Kwota musi być większa od 0.');
    }
    if (transferred > doc.wallet) {
      return fail(
        'INSUFFICIENT_FUNDS',
        `Masz tylko **${doc.wallet}** w portfelu.`,
      );
    }

    const updated = await atomicUpdate({
      guildId,
      userId,
      type: TransactionType.DEPOSIT,
      walletDelta: -transferred,
      bankDelta: transferred,
      netWorthDelta: 0,
    });

    return ok({ wallet: updated.wallet, bank: updated.bank, transferred });
  } catch (err) {
    logger.error('economyService.deposit failed', { guildId, userId, amount, err });
    return fail('INTERNAL_ERROR', 'Nie udało się wykonać wpłaty.');
  }
}

/**
 * Wypłać z banku (Bank → Portfel).
 * Nie zmienia netWorth — to transfer wewnętrzny.
 */
export async function withdraw(
  guildId: string,
  userId: string,
  amount: number | 'all',
): Promise<ServiceResult<{ wallet: number; bank: number; transferred: number }>> {
  try {
    if (!(await isEconomyEnabled(guildId))) {
      return fail('DISABLED', 'System ekonomii jest wyłączony na tym serwerze.');
    }

    const doc = await getOrCreateWallet(guildId, userId);
    const transferred = amount === 'all' ? doc.bank : amount;

    if (transferred <= 0) {
      return fail('INVALID_AMOUNT', 'Kwota musi być większa od 0.');
    }
    if (transferred > doc.bank) {
      return fail(
        'INSUFFICIENT_FUNDS',
        `Masz tylko **${doc.bank}** w banku.`,
      );
    }

    const updated = await atomicUpdate({
      guildId,
      userId,
      type: TransactionType.WITHDRAW,
      walletDelta: transferred,
      bankDelta: -transferred,
      netWorthDelta: 0,
    });

    return ok({ wallet: updated.wallet, bank: updated.bank, transferred });
  } catch (err) {
    logger.error('economyService.withdraw failed', { guildId, userId, amount, err });
    return fail('INTERNAL_ERROR', 'Nie udało się wykonać wypłaty.');
  }
}

/**
 * Przelew z portfela do portfela innego użytkownika.
 * Obie strony dostają wpis w ledgerze.
 */
export async function send(
  guildId: string,
  senderId: string,
  receiverId: string,
  amount: number,
): Promise<ServiceResult<TransferResult>> {
  try {
    if (!(await isEconomyEnabled(guildId))) {
      return fail('DISABLED', 'System ekonomii jest wyłączony na tym serwerze.');
    }
    if (amount <= 0) {
      return fail('INVALID_AMOUNT', 'Kwota musi być większa od 0.');
    }
    if (senderId === receiverId) {
      return fail('SELF_TRANSFER', 'Nie możesz wysłać monet do siebie.');
    }

    const config = await EconomyConfigModel.findOne({ guildId }).lean();
    const maxTransfer = config?.maxTransfer ?? 100_000;
    if (amount > maxTransfer) {
      return fail('EXCEEDS_LIMIT', `Maksymalny przelew to **${maxTransfer}** na raz.`);
    }

    const sender = await getOrCreateWallet(guildId, senderId);
    if (amount > sender.wallet) {
      return fail(
        'INSUFFICIENT_FUNDS',
        `Masz tylko **${sender.wallet}** w portfelu.`,
      );
    }

    // Dedukcja od nadawcy
    const updatedSender = await EconomyModel.findOneAndUpdate(
      { guildId, userId: senderId },
      {
        $inc: { wallet: -amount, netWorth: -amount, totalSpent: amount },
        $set: { lastActivityAt: new Date() },
      },
      { new: true },
    );
    if (!updatedSender) return fail('INTERNAL_ERROR', 'Błąd aktualizacji nadawcy.');

    // Dodanie do odbiorcy
    const updatedReceiver = await EconomyModel.findOneAndUpdate(
      { guildId, userId: receiverId },
      {
        $inc: { wallet: amount, netWorth: amount, totalEarned: amount },
        $set: { lastActivityAt: new Date() },
      },
      { new: true, upsert: true },
    );
    if (!updatedReceiver) return fail('INTERNAL_ERROR', 'Błąd aktualizacji odbiorcy.');

    // Ledger — oba wpisy
    await EconomyTransactionModel.insertMany([
      {
        guildId,
        userId: senderId,
        type: TransactionType.SEND,
        amount: -amount,
        walletAfter: updatedSender.wallet,
        bankAfter: updatedSender.bank,
        targetUserId: receiverId,
      },
      {
        guildId,
        userId: receiverId,
        type: TransactionType.PAYMENT,
        amount,
        walletAfter: updatedReceiver.wallet,
        bankAfter: updatedReceiver.bank,
        targetUserId: senderId,
      },
    ]);

    return ok({
      senderWallet: updatedSender.wallet,
      senderBank: updatedSender.bank,
      receiverWallet: updatedReceiver.wallet,
    });
  } catch (err) {
    logger.error('economyService.send failed', { guildId, senderId, receiverId, amount, err });
    return fail('INTERNAL_ERROR', 'Nie udało się wysłać monet.');
  }
}

/** Ranking użytkowników w gildii według wybranego kryterium. */
export async function getLeaderboard(
  guildId: string,
  mode: LeaderboardMode = 'wealth',
  page = 1,
  pageSize = 10,
): Promise<ServiceResult<LeaderboardData>> {
  try {
    if (!(await isEconomyEnabled(guildId))) {
      return fail('DISABLED', 'System ekonomii jest wyłączony na tym serwerze.');
    }

    const sortFieldMap: Record<LeaderboardMode, string> = {
      wealth: 'netWorth',
      wallet: 'wallet',
      bank: 'bank',
      earned: 'totalEarned',
      gambling: 'totalWon',
    };

    const sortField = sortFieldMap[mode];
    const skip = (page - 1) * pageSize;

    const [entries, totalUsers] = await Promise.all([
      EconomyModel.find({ guildId })
        .sort({ [sortField]: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      EconomyModel.countDocuments({ guildId }),
    ]);

    return ok({
      entries: entries.map((e, i) => ({
        userId: e.userId,
        wallet: e.wallet,
        bank: e.bank,
        netWorth: e.netWorth,
        totalEarned: e.totalEarned,
        totalWon: e.totalWon,
        rank: skip + i + 1,
      })),
      totalUsers,
    });
  } catch (err) {
    logger.error('economyService.getLeaderboard failed', { guildId, mode, page, err });
    return fail('INTERNAL_ERROR', 'Nie udało się pobrać rankingu.');
  }
}

/** Ostatnie N transakcji użytkownika z ledgera. */
export async function getHistory(
  guildId: string,
  userId: string,
  limit = 10,
): Promise<ServiceResult<HistoryEntry[]>> {
  try {
    const entries = await EconomyTransactionModel.find({ guildId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return ok(
      entries.map((e) => ({
        type: e.type as TransactionType,
        amount: e.amount,
        walletAfter: e.walletAfter,
        bankAfter: e.bankAfter,
        targetUserId: e.targetUserId,
        createdAt: e.createdAt as Date,
      })),
    );
  } catch (err) {
    logger.error('economyService.getHistory failed', { guildId, userId, err });
    return fail('INTERNAL_ERROR', 'Nie udało się pobrać historii.');
  }
}
