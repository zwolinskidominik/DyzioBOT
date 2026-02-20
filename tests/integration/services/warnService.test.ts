import { WarnModel } from '../../../src/models/Warn';
import {
  addWarn,
  removeWarn,
  getWarnings,
  cleanExpiredWarns,
  WARN_LIMIT,
  WARN_PUNISHMENTS,
} from '../../../src/services/warnService';

const GID = 'guild-1';
const UID = 'user-1';
const MOD = 'mod-1';

/* ================================================================ */
/*  addWarn                                                          */
/* ================================================================ */
describe('addWarn', () => {
  it('creates a new record and returns count=1', async () => {
    const res = await addWarn({
      guildId: GID,
      userId: UID,
      reason: 'spam',
      moderatorId: MOD,
      moderatorTag: 'Mod#0001',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(1);
    expect(res.data.shouldBan).toBe(false);
    expect(res.data.punishment).toEqual(WARN_PUNISHMENTS[1]);
    expect(res.data.nextPunishment).toEqual(WARN_PUNISHMENTS[2]);
  });

  it('appends warnings to an existing record', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'r1', moderatorId: MOD, moderatorTag: 'M' });
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'r2', moderatorId: MOD, moderatorTag: 'M' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(2);
    expect(res.data.punishment).toEqual(WARN_PUNISHMENTS[2]);
  });

  it('returns shouldBan=true when reaching WARN_LIMIT', async () => {
    for (let i = 0; i < WARN_LIMIT - 1; i++) {
      await addWarn({ guildId: GID, userId: UID, reason: `r${i}`, moderatorId: MOD, moderatorTag: 'M' });
    }

    const res = await addWarn({ guildId: GID, userId: UID, reason: 'final', moderatorId: MOD, moderatorTag: 'M' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(WARN_LIMIT);
    expect(res.data.shouldBan).toBe(true);
  });

  it('returns shouldBan=true when exceeding WARN_LIMIT', async () => {
    for (let i = 0; i < WARN_LIMIT; i++) {
      await addWarn({ guildId: GID, userId: UID, reason: `r${i}`, moderatorId: MOD, moderatorTag: 'M' });
    }
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'extra', moderatorId: MOD, moderatorTag: 'M' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.shouldBan).toBe(true);
  });

  it('persists moderator metadata', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'test', moderatorId: MOD, moderatorTag: 'Mod#0001' });

    const doc = await WarnModel.findOne({ userId: UID, guildId: GID }).lean();
    expect(doc?.warnings[0].moderatorId).toBe(MOD);
    expect(doc?.warnings[0].moderatorTag).toBe('Mod#0001');
  });

  it('isolates records by guildId', async () => {
    await addWarn({ guildId: 'g1', userId: UID, reason: 'a', moderatorId: MOD, moderatorTag: 'M' });
    await addWarn({ guildId: 'g2', userId: UID, reason: 'b', moderatorId: MOD, moderatorTag: 'M' });

    const r1 = await getWarnings({ guildId: 'g1', userId: UID });
    const r2 = await getWarnings({ guildId: 'g2', userId: UID });

    expect(r1.ok && r1.data.count).toBe(1);
    expect(r2.ok && r2.data.count).toBe(1);
  });

  it('returns nextPunishment=null after the last defined level', async () => {
    // WARN_PUNISHMENTS goes up to 4; adding a 5th warn → no next punishment defined
    for (let i = 0; i < WARN_LIMIT; i++) {
      await addWarn({ guildId: GID, userId: UID, reason: `r${i}`, moderatorId: MOD, moderatorTag: 'M' });
    }
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'over', moderatorId: MOD, moderatorTag: 'M' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.nextPunishment).toBeNull();
  });
});

/* ================================================================ */
/*  removeWarn                                                       */
/* ================================================================ */
describe('removeWarn', () => {
  it('removes a warning by 1-based index', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'first', moderatorId: MOD, moderatorTag: 'M' });
    await addWarn({ guildId: GID, userId: UID, reason: 'second', moderatorId: MOD, moderatorTag: 'M' });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 1 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.remainingCount).toBe(1);

    // verify the correct one was removed
    const after = await getWarnings({ guildId: GID, userId: UID });
    expect(after.ok && after.data.warnings[0].reason).toBe('second');
  });

  it('returns NO_WARNINGS when user has no record', async () => {
    const res = await removeWarn({ guildId: GID, userId: 'ghost', warningIndex: 1 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_WARNINGS');
  });

  it('returns INVALID_INDEX for index < 1', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M' });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 0 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_INDEX');
  });

  it('returns INVALID_INDEX for index > warnings count', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M' });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 5 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_INDEX');
  });
});

/* ================================================================ */
/*  getWarnings                                                      */
/* ================================================================ */
describe('getWarnings', () => {
  it('returns empty array when user has no record', async () => {
    const res = await getWarnings({ guildId: GID, userId: 'newcomer' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(0);
    expect(res.data.warnings).toEqual([]);
  });

  it('returns all warnings with correct fields', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'spam', moderatorId: MOD, moderatorTag: 'Mod#1' });
    await addWarn({ guildId: GID, userId: UID, reason: 'toxicity', moderatorId: 'mod-2', moderatorTag: 'Mod#2' });

    const res = await getWarnings({ guildId: GID, userId: UID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(2);
    expect(res.data.warnings[0].reason).toBe('spam');
    expect(res.data.warnings[1].reason).toBe('toxicity');
    expect(res.data.warnings[0].moderatorId).toBe(MOD);
    expect(res.data.warnings[0]).toHaveProperty('date');
  });
});

/* ================================================================ */
/*  cleanExpiredWarns                                                */
/* ================================================================ */
describe('cleanExpiredWarns', () => {
  it('removes warnings older than monthsAgo threshold', async () => {
    // Insert a record with an old warning directly
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 4); // 4 months ago

    await WarnModel.create({
      userId: UID,
      guildId: GID,
      warnings: [
        { reason: 'old', date: oldDate, moderatorId: MOD },
        { reason: 'recent', date: new Date(), moderatorId: MOD },
      ],
    });

    const res = await cleanExpiredWarns({ guildId: GID, monthsAgo: 3 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.totalRemoved).toBe(1);
    expect(res.data.usersAffected).toBe(1);

    // Verify only recent warning remains
    const after = await getWarnings({ guildId: GID, userId: UID });
    expect(after.ok && after.data.count).toBe(1);
  });

  it('does nothing when all warnings are recent', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'fresh', moderatorId: MOD, moderatorTag: 'M' });

    const res = await cleanExpiredWarns({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.totalRemoved).toBe(0);
    expect(res.data.usersAffected).toBe(0);
  });

  it('processes multiple users', async () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 4);

    await WarnModel.create({ userId: 'u1', guildId: GID, warnings: [{ reason: 'old', date: oldDate, moderatorId: MOD }] });
    await WarnModel.create({ userId: 'u2', guildId: GID, warnings: [{ reason: 'old', date: oldDate, moderatorId: MOD }] });

    const res = await cleanExpiredWarns({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.totalRemoved).toBe(2);
    expect(res.data.usersAffected).toBe(2);
  });

  it('defaults to 3 months when monthsAgo is omitted', async () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    await WarnModel.create({
      userId: UID,
      guildId: GID,
      warnings: [{ reason: '2mo-old', date: twoMonthsAgo, moderatorId: MOD }],
    });

    const res = await cleanExpiredWarns({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 2 months < 3 month default → should NOT be removed
    expect(res.data.totalRemoved).toBe(0);
  });
});
