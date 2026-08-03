import {
  getOrCreateWallet,
  getBalance,
  getUserRank,
  deposit,
  withdraw,
  send,
  getLeaderboard,
  getHistory,
  getCurrencyConfig,
} from '../../../src/services/economyService';
import { EconomyModel } from '../../../src/models/Economy';
import { EconomyTransactionModel, TransactionType } from '../../../src/models/EconomyTransaction';
import { EconomyConfigModel } from '../../../src/models/EconomyConfig';

const GID = 'test-guild';
const UID = 'user-1';
const UID2 = 'user-2';
const UID3 = 'user-3';

/* ══════════════════════════════════════════════════════════════════
   getOrCreateWallet
══════════════════════════════════════════════════════════════════ */
describe('getOrCreateWallet', () => {
  it('tworzy nowe konto z domyślnym saldem 0', async () => {
    const doc = await getOrCreateWallet(GID, UID);
    expect(doc.wallet).toBe(0);
    expect(doc.bank).toBe(0);
    expect(doc.guildId).toBe(GID);
    expect(doc.userId).toBe(UID);
  });

  it('zwraca istniejące konto bez resetowania', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 500, bank: 200 });
    const doc = await getOrCreateWallet(GID, UID);
    expect(doc.wallet).toBe(500);
    expect(doc.bank).toBe(200);
  });

  it('używa startingBalance z konfiguracji gildii', async () => {
    await EconomyConfigModel.create({ guildId: GID, startingBalance: 100 });
    const doc = await getOrCreateWallet(GID, UID);
    expect(doc.wallet).toBe(100);
  });

  it('izoluje konta per guildId', async () => {
    const d1 = await getOrCreateWallet('g1', UID);
    const d2 = await getOrCreateWallet('g2', UID);
    expect(d1.guildId).toBe('g1');
    expect(d2.guildId).toBe('g2');
  });
});

/* ══════════════════════════════════════════════════════════════════
   getBalance
══════════════════════════════════════════════════════════════════ */
describe('getBalance', () => {
  it('zwraca poprawne dane salda', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 300, bank: 700 });
    const result = await getBalance(GID, UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(300);
    expect(result.data.bank).toBe(700);
  });

  it('tworzy konto jeśli nie istnieje', async () => {
    const result = await getBalance(GID, UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════
   getCurrencyConfig
══════════════════════════════════════════════════════════════════ */
describe('getCurrencyConfig', () => {
  it('zwraca domyślną walutę gdy brak konfiguracji', async () => {
    const cfg = await getCurrencyConfig(GID);
    expect(cfg.currencyName).toBe('GameCoins');
    expect(cfg.currencySymbol).toBe('🪙');
  });

  it('zwraca konfigurację per-guild', async () => {
    await EconomyConfigModel.create({
      guildId: GID,
      currencyName: 'DeezyCoins',
      currencySymbol: '💎',
    });
    const cfg = await getCurrencyConfig(GID);
    expect(cfg.currencyName).toBe('DeezyCoins');
    expect(cfg.currencySymbol).toBe('💎');
  });
});

/* ══════════════════════════════════════════════════════════════════
   getUserRank
══════════════════════════════════════════════════════════════════ */
describe('getUserRank', () => {
  it('zwraca rank 1 gdy użytkownik ma najwyższy netWorth', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, netWorth: 1000 });
    await EconomyModel.create({ guildId: GID, userId: UID2, netWorth: 500 });
    const result = await getUserRank(GID, UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(1);
  });

  it('zwraca rank 2 gdy jest jeden gracz wyżej', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, netWorth: 500 });
    await EconomyModel.create({ guildId: GID, userId: UID2, netWorth: 1000 });
    const result = await getUserRank(GID, UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(2);
  });

  it('zwraca 0 gdy użytkownik nie istnieje', async () => {
    const result = await getUserRank(GID, 'ghost');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════
   deposit
══════════════════════════════════════════════════════════════════ */
describe('deposit', () => {
  it('przenosi kwotę z portfela do banku', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 1000, bank: 0 });
    const result = await deposit(GID, UID, 400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(600);
    expect(result.data.bank).toBe(400);
    expect(result.data.transferred).toBe(400);
  });

  it('"all" wpłaca całe saldo portfela', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 750, bank: 100 });
    const result = await deposit(GID, UID, 'all');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(0);
    expect(result.data.bank).toBe(850);
    expect(result.data.transferred).toBe(750);
  });

  it('nie zmienia netWorth (transfer wewnętrzny)', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 500, bank: 200, netWorth: 700 });
    const result = await deposit(GID, UID, 300);
    expect(result.ok).toBe(true);
    const doc = await EconomyModel.findOne({ guildId: GID, userId: UID }).lean();
    expect(doc?.netWorth).toBe(700);
  });

  it('zapisuje wpis w ledgerze', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 500 });
    await deposit(GID, UID, 200);
    const tx = await EconomyTransactionModel.findOne({ guildId: GID, userId: UID }).lean();
    expect(tx?.type).toBe(TransactionType.DEPOSIT);
    expect(tx?.amount).toBe(0); // walletDelta + bankDelta = -200 + 200 = 0
  });

  it('zwraca INSUFFICIENT_FUNDS gdy za mało w portfelu', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 100 });
    const result = await deposit(GID, UID, 200);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('zwraca INVALID_AMOUNT dla kwoty <= 0', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 100 });
    const result = await deposit(GID, UID, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_AMOUNT');
  });

  it('"all" gdy portfel pusty zwraca INVALID_AMOUNT', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 0 });
    const result = await deposit(GID, UID, 'all');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_AMOUNT');
  });
});

/* ══════════════════════════════════════════════════════════════════
   withdraw
══════════════════════════════════════════════════════════════════ */
describe('withdraw', () => {
  it('przenosi kwotę z banku do portfela', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 0, bank: 1000 });
    const result = await withdraw(GID, UID, 300);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(300);
    expect(result.data.bank).toBe(700);
    expect(result.data.transferred).toBe(300);
  });

  it('"all" wypłaca całe saldo banku', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 50, bank: 800 });
    const result = await withdraw(GID, UID, 'all');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.wallet).toBe(850);
    expect(result.data.bank).toBe(0);
  });

  it('nie zmienia netWorth (transfer wewnętrzny)', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 0, bank: 600, netWorth: 600 });
    await withdraw(GID, UID, 400);
    const doc = await EconomyModel.findOne({ guildId: GID, userId: UID }).lean();
    expect(doc?.netWorth).toBe(600);
  });

  it('zwraca INSUFFICIENT_FUNDS gdy za mało w banku', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, bank: 50 });
    const result = await withdraw(GID, UID, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('zwraca INVALID_AMOUNT dla kwoty <= 0', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, bank: 100 });
    const result = await withdraw(GID, UID, -5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_AMOUNT');
  });
});

/* ══════════════════════════════════════════════════════════════════
   send
══════════════════════════════════════════════════════════════════ */
describe('send', () => {
  it('przelewa monety między portfelami', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 1000, netWorth: 1000 });
    await EconomyModel.create({ guildId: GID, userId: UID2, wallet: 0, netWorth: 0 });
    const result = await send(GID, UID, UID2, 400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.senderWallet).toBe(600);
    expect(result.data.receiverWallet).toBe(400);
  });

  it('aktualizuje netWorth obu stron', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 800, netWorth: 800 });
    await EconomyModel.create({ guildId: GID, userId: UID2, wallet: 200, netWorth: 200 });
    await send(GID, UID, UID2, 300);
    const sender = await EconomyModel.findOne({ guildId: GID, userId: UID }).lean();
    const receiver = await EconomyModel.findOne({ guildId: GID, userId: UID2 }).lean();
    expect(sender?.netWorth).toBe(500);
    expect(receiver?.netWorth).toBe(500);
  });

  it('zapisuje dwa wpisy w ledgerze (SEND + PAYMENT)', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 500, netWorth: 500 });
    await send(GID, UID, UID2, 100);
    const txs = await EconomyTransactionModel.find({ guildId: GID }).lean();
    expect(txs).toHaveLength(2);
    const types = txs.map((t) => t.type).sort();
    expect(types).toContain(TransactionType.SEND);
    expect(types).toContain(TransactionType.PAYMENT);
  });

  it('tworzy konto odbiorcy jeśli nie istnieje', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 300, netWorth: 300 });
    const result = await send(GID, UID, 'new-user', 100);
    expect(result.ok).toBe(true);
    const receiver = await EconomyModel.findOne({ guildId: GID, userId: 'new-user' }).lean();
    expect(receiver?.wallet).toBe(100);
  });

  it('zwraca SELF_TRANSFER przy próbie wysłania do siebie', async () => {
    const result = await send(GID, UID, UID, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('SELF_TRANSFER');
  });

  it('zwraca INVALID_AMOUNT dla kwoty <= 0', async () => {
    const result = await send(GID, UID, UID2, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_AMOUNT');
  });

  it('zwraca INSUFFICIENT_FUNDS gdy za mało w portfelu', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 50 });
    const result = await send(GID, UID, UID2, 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('zwraca EXCEEDS_LIMIT gdy kwota > maxTransfer', async () => {
    await EconomyConfigModel.create({ guildId: GID, maxTransfer: 500 });
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 10_000, netWorth: 10_000 });
    const result = await send(GID, UID, UID2, 501);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EXCEEDS_LIMIT');
  });

  it('izoluje transakcje per guildId', async () => {
    await EconomyModel.create({ guildId: 'g1', userId: UID, wallet: 500, netWorth: 500 });
    await EconomyModel.create({ guildId: 'g2', userId: UID, wallet: 500, netWorth: 500 });
    await send('g1', UID, UID2, 200);
    const g1sender = await EconomyModel.findOne({ guildId: 'g1', userId: UID }).lean();
    const g2sender = await EconomyModel.findOne({ guildId: 'g2', userId: UID }).lean();
    expect(g1sender?.wallet).toBe(300);
    expect(g2sender?.wallet).toBe(500);
  });
});

/* ══════════════════════════════════════════════════════════════════
   getLeaderboard
══════════════════════════════════════════════════════════════════ */
describe('getLeaderboard', () => {
  beforeEach(async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 500, bank: 500, netWorth: 1000, totalEarned: 2000, totalWon: 800 });
    await EconomyModel.create({ guildId: GID, userId: UID2, wallet: 200, bank: 100, netWorth: 300, totalEarned: 500, totalWon: 100 });
    await EconomyModel.create({ guildId: GID, userId: UID3, wallet: 800, bank: 700, netWorth: 1500, totalEarned: 3000, totalWon: 50 });
  });

  it('sortuje wealth malejąco', async () => {
    const result = await getLeaderboard(GID, 'wealth');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries[0].userId).toBe(UID3);
    expect(result.data.entries[1].userId).toBe(UID);
    expect(result.data.entries[2].userId).toBe(UID2);
  });

  it('sortuje wallet malejąco', async () => {
    const result = await getLeaderboard(GID, 'wallet');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries[0].userId).toBe(UID3);
  });

  it('sortuje earned malejąco', async () => {
    const result = await getLeaderboard(GID, 'earned');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries[0].userId).toBe(UID3);
  });

  it('sortuje gambling (totalWon) malejąco', async () => {
    const result = await getLeaderboard(GID, 'gambling');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries[0].userId).toBe(UID);
  });

  it('zwraca poprawny totalUsers', async () => {
    const result = await getLeaderboard(GID, 'wealth');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalUsers).toBe(3);
  });

  it('paginuje wyniki', async () => {
    const result = await getLeaderboard(GID, 'wealth', 1, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries).toHaveLength(2);
    expect(result.data.entries[0].rank).toBe(1);
    expect(result.data.entries[1].rank).toBe(2);
  });

  it('strona 2 zwraca pozostałe wyniki', async () => {
    const result = await getLeaderboard(GID, 'wealth', 2, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries).toHaveLength(1);
    expect(result.data.entries[0].rank).toBe(3);
  });

  it('izoluje ranking per guildId', async () => {
    await EconomyModel.create({ guildId: 'other', userId: 'x', netWorth: 9999 });
    const result = await getLeaderboard(GID, 'wealth');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalUsers).toBe(3);
  });
});

/* ══════════════════════════════════════════════════════════════════
   getHistory
══════════════════════════════════════════════════════════════════ */
describe('getHistory', () => {
  it('zwraca historię transakcji posortowaną malejąco', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 1000 });
    await deposit(GID, UID, 200);
    await deposit(GID, UID, 300);
    const result = await getHistory(GID, UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    // Nowsza transakcja pierwsza
    expect(result.data[0].type).toBe(TransactionType.DEPOSIT);
  });

  it('respektuje limit', async () => {
    await EconomyModel.create({ guildId: GID, userId: UID, wallet: 5000 });
    for (let i = 0; i < 5; i++) await deposit(GID, UID, 100);
    const result = await getHistory(GID, UID, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
  });

  it('zwraca pustą tablicę gdy brak historii', async () => {
    const result = await getHistory(GID, 'new-user');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('izoluje historię per guildId', async () => {
    await EconomyModel.create({ guildId: 'g1', userId: UID, wallet: 500 });
    await EconomyModel.create({ guildId: 'g2', userId: UID, wallet: 500 });
    await deposit('g1', UID, 100);
    const result = await getHistory('g2', UID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });
});
