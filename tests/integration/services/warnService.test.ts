import { WarnModel } from '../../../src/models/Warn';
import {
  addWarn,
  removeWarn,
  removeWarnById,
  getWarnings,
  cleanExpiredWarns,
  DEFAULT_WARN_STEPS,
  WarnStep,
} from '../../../src/services/warnService';

const GID = 'guild-1';
const UID = 'user-1';
const MOD = 'mod-1';
const STEPS = DEFAULT_WARN_STEPS; // [15min mute, 3h mute, 1dzień mute, ban] — 4 stopnie

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
      steps: STEPS,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(1);
    expect(res.data.isFinal).toBe(false);
    expect(res.data.step.action).toBe('mute');
    expect(res.data.step.durationMinutes).toBe(15);
    expect(res.data.nextStep.durationMinutes).toBe(180);
    expect(res.data.warnEntryId).toEqual(expect.any(String));
  });

  it('appends warnings to an existing record', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'r1', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'r2', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(2);
    expect(res.data.step.durationMinutes).toBe(180);
  });

  it('returns isFinal=true and action=ban when reaching the last step', async () => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      await addWarn({ guildId: GID, userId: UID, reason: `r${i}`, moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    }

    const res = await addWarn({ guildId: GID, userId: UID, reason: 'final', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(STEPS.length);
    expect(res.data.isFinal).toBe(true);
    expect(res.data.step.action).toBe('ban');
  });

  it('keeps repeating the last step when exceeding the ladder length', async () => {
    for (let i = 0; i < STEPS.length; i++) {
      await addWarn({ guildId: GID, userId: UID, reason: `r${i}`, moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    }
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'extra', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.isFinal).toBe(true);
    expect(res.data.step.action).toBe('ban');
  });

  it('persists moderator metadata', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'test', moderatorId: MOD, moderatorTag: 'Mod#0001', steps: STEPS });

    const doc = await WarnModel.findOne({ userId: UID, guildId: GID }).lean();
    expect(doc?.warnings[0].moderatorId).toBe(MOD);
    expect(doc?.warnings[0].moderatorTag).toBe('Mod#0001');
  });

  it('isolates records by guildId', async () => {
    await addWarn({ guildId: 'g1', userId: UID, reason: 'a', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    await addWarn({ guildId: 'g2', userId: UID, reason: 'b', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    const r1 = await getWarnings({ guildId: 'g1', userId: UID });
    const r2 = await getWarnings({ guildId: 'g2', userId: UID });

    expect(r1.ok && r1.data.count).toBe(1);
    expect(r2.ok && r2.data.count).toBe(1);
  });

  it('single-step ladder repeats the same action for every warn (tryb "single")', async () => {
    const singleSteps: WarnStep[] = [{ action: 'mute', durationMinutes: 15 }];

    const res1 = await addWarn({ guildId: GID, userId: UID, reason: 'a', moderatorId: MOD, moderatorTag: 'M', steps: singleSteps });
    const res2 = await addWarn({ guildId: GID, userId: UID, reason: 'b', moderatorId: MOD, moderatorTag: 'M', steps: singleSteps });

    expect(res1.ok && res1.data.step.durationMinutes).toBe(15);
    expect(res2.ok && res2.data.step.durationMinutes).toBe(15);
    expect(res1.ok && res1.data.isFinal).toBe(true);
    expect(res2.ok && res2.data.isFinal).toBe(true);
  });

  it('fails with INVALID_CONFIG when steps is empty', async () => {
    const res = await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M', steps: [] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_CONFIG');
  });
});

/* ================================================================ */
/*  removeWarn                                                       */
/* ================================================================ */
describe('removeWarn', () => {
  it('removes a warning by 1-based index', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'first', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    await addWarn({ guildId: GID, userId: UID, reason: 'second', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 1 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.remainingCount).toBe(1);
    expect(res.data.removedId).toEqual(expect.any(String));

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
    await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 0 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_INDEX');
  });

  it('returns INVALID_INDEX for index > warnings count', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    const res = await removeWarn({ guildId: GID, userId: UID, warningIndex: 5 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_INDEX');
  });
});

/* ================================================================ */
/*  removeWarnById                                                   */
/* ================================================================ */
describe('removeWarnById', () => {
  it('removes the warning matching the given _id, regardless of position', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'first', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    const second = await addWarn({ guildId: GID, userId: UID, reason: 'second', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const res = await removeWarnById({ guildId: GID, userId: UID, warnEntryId: second.data.warnEntryId });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.remainingCount).toBe(1);

    const after = await getWarnings({ guildId: GID, userId: UID });
    expect(after.ok && after.data.warnings[0].reason).toBe('first');
  });

  it('returns INVALID_INDEX when the id does not match any entry', async () => {
    await addWarn({ guildId: GID, userId: UID, reason: 'x', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

    const res = await removeWarnById({ guildId: GID, userId: UID, warnEntryId: '64b000000000000000000000' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_INDEX');
  });

  it('returns NO_WARNINGS when user has no record', async () => {
    const res = await removeWarnById({ guildId: GID, userId: 'ghost', warnEntryId: '64b000000000000000000000' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_WARNINGS');
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
    await addWarn({ guildId: GID, userId: UID, reason: 'spam', moderatorId: MOD, moderatorTag: 'Mod#1', steps: STEPS });
    await addWarn({ guildId: GID, userId: UID, reason: 'toxicity', moderatorId: 'mod-2', moderatorTag: 'Mod#2', steps: STEPS });

    const res = await getWarnings({ guildId: GID, userId: UID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.count).toBe(2);
    expect(res.data.warnings[0].reason).toBe('spam');
    expect(res.data.warnings[1].reason).toBe('toxicity');
    expect(res.data.warnings[0].moderatorId).toBe(MOD);
    expect(res.data.warnings[0]).toHaveProperty('date');
    expect(res.data.warnings[0]).toHaveProperty('id');
    expect(res.data.warnings[0].id).toEqual(expect.any(String));
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
    await addWarn({ guildId: GID, userId: UID, reason: 'fresh', moderatorId: MOD, moderatorTag: 'M', steps: STEPS });

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

  it('without guildId, cleans expired warnings across ALL guilds (bot is multi-tenant)', async () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 4);

    await WarnModel.create({ userId: 'u1', guildId: GID, warnings: [{ reason: 'old', date: oldDate, moderatorId: MOD }] });
    await WarnModel.create({ userId: 'u2', guildId: 'other-guild', warnings: [{ reason: 'old', date: oldDate, moderatorId: MOD }] });

    const res = await cleanExpiredWarns({});

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.totalRemoved).toBe(2);
    expect(res.data.usersAffected).toBe(2);

    const afterOther = await getWarnings({ guildId: 'other-guild', userId: 'u2' });
    expect(afterOther.ok && afterOther.data.count).toBe(0);
  });
});
