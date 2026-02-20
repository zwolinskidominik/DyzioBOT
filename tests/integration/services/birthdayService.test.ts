import { BirthdayModel } from '../../../src/models/Birthday';
import { BirthdayConfigurationModel } from '../../../src/models/BirthdayConfiguration';
import {
  setBirthday,
  getBirthday,
  getUpcomingBirthdays,
  getTodayBirthdays,
  getBirthdayConfigs,
  parseBirthdayDate,
  getDaysForm,
} from '../../../src/services/birthdayService';

const GID = 'guild-1';
const UID = 'user-1';

/* ================================================================ */
/*  parseBirthdayDate (pure)                                         */
/* ================================================================ */
describe('parseBirthdayDate', () => {
  it('parses DD-MM-YYYY format', () => {
    const r = parseBirthdayDate('15-04-1994');
    expect(r.isValid).toBe(true);
    expect(r.yearSpecified).toBe(true);
    expect(r.date!.getFullYear()).toBe(1994);
    expect(r.date!.getMonth()).toBe(3); // 0-indexed
    expect(r.date!.getDate()).toBe(15);
  });

  it('parses DD-MM format (year=1970)', () => {
    const r = parseBirthdayDate('25-12');
    expect(r.isValid).toBe(true);
    expect(r.yearSpecified).toBe(false);
    expect(r.date!.getMonth()).toBe(11);
    expect(r.date!.getDate()).toBe(25);
  });

  it('rejects invalid format', () => {
    const r = parseBirthdayDate('2004/04/15');
    expect(r.isValid).toBe(false);
    expect(r.errorMessage).toContain('format');
  });

  it('rejects invalid date values', () => {
    const r = parseBirthdayDate('99-99-9999');
    expect(r.isValid).toBe(false);
  });
});

/* ================================================================ */
/*  getDaysForm (pure)                                               */
/* ================================================================ */
describe('getDaysForm', () => {
  it('returns "dzień" for 1', () => expect(getDaysForm(1)).toBe('dzień'));
  it('returns "dni" for >1', () => expect(getDaysForm(5)).toBe('dni'));
});

/* ================================================================ */
/*  setBirthday                                                      */
/* ================================================================ */
describe('setBirthday', () => {
  it('creates a new birthday record', async () => {
    const res = await setBirthday({ guildId: GID, userId: UID, dateString: '15-04-1994' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.yearSpecified).toBe(true);
    expect(res.data.active).toBe(true);
  });

  it('upserts existing birthday', async () => {
    await setBirthday({ guildId: GID, userId: UID, dateString: '15-04-1994' });
    const res = await setBirthday({ guildId: GID, userId: UID, dateString: '01-01' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.yearSpecified).toBe(false);

    // Only one record should exist
    const count = await BirthdayModel.countDocuments({ userId: UID, guildId: GID });
    expect(count).toBe(1);
  });

  it('returns INVALID_DATE for bad input', async () => {
    const res = await setBirthday({ guildId: GID, userId: UID, dateString: 'not-a-date' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_DATE');
  });
});

/* ================================================================ */
/*  getBirthday                                                      */
/* ================================================================ */
describe('getBirthday', () => {
  it('returns null when no birthday exists', async () => {
    const res = await getBirthday({ guildId: GID, userId: 'nobody' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBeNull();
  });

  it('returns birthday data when exists', async () => {
    await setBirthday({ guildId: GID, userId: UID, dateString: '25-12-2000' });

    const res = await getBirthday({ guildId: GID, userId: UID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).not.toBeNull();
    expect(res.data!.yearSpecified).toBe(true);
  });
});

/* ================================================================ */
/*  getUpcomingBirthdays                                             */
/* ================================================================ */
describe('getUpcomingBirthdays', () => {
  it('returns empty array when no birthdays', async () => {
    const res = await getUpcomingBirthdays({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });

  it('returns upcoming birthdays sorted by daysUntil', async () => {
    // Create birthdays with specific dates relative to today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}`;
    const nextWeekStr = `${String(nextWeek.getDate()).padStart(2, '0')}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}`;

    await setBirthday({ guildId: GID, userId: 'u-later', dateString: nextWeekStr });
    await setBirthday({ guildId: GID, userId: 'u-soon', dateString: tomorrowStr });

    const res = await getUpcomingBirthdays({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(2);
    expect(res.data[0].userId).toBe('u-soon');
    expect(res.data[1].userId).toBe('u-later');
  });

  it('respects the limit parameter', async () => {
    const today = new Date();
    for (let i = 1; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      await setBirthday({ guildId: GID, userId: `u${i}`, dateString: ds });
    }

    const res = await getUpcomingBirthdays({ guildId: GID, limit: 3 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(3);
  });
});

/* ================================================================ */
/*  getTodayBirthdays                                                */
/* ================================================================ */
describe('getTodayBirthdays', () => {
  it('returns empty when no birthdays today', async () => {
    // Create a birthday for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ds = `${String(tomorrow.getDate()).padStart(2, '0')}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}`;
    await setBirthday({ guildId: GID, userId: UID, dateString: ds });

    const res = await getTodayBirthdays({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });

  it('returns users whose birthday is today', async () => {
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    await setBirthday({ guildId: GID, userId: 'birthday-person', dateString: todayStr });

    const res = await getTodayBirthdays({ guildId: GID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(1);
    expect(res.data[0].userId).toBe('birthday-person');
  });
});

/* ================================================================ */
/*  getBirthdayConfigs                                               */
/* ================================================================ */
describe('getBirthdayConfigs', () => {
  it('returns empty when no configs', async () => {
    const res = await getBirthdayConfigs();

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });

  it('returns all configs', async () => {
    await BirthdayConfigurationModel.create({
      guildId: GID,
      birthdayChannelId: 'chan-1',
      enabled: true,
      message: 'Happy birthday {user}!',
    });

    const res = await getBirthdayConfigs();

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(1);
    expect(res.data[0].guildId).toBe(GID);
    expect(res.data[0].message).toBe('Happy birthday {user}!');
  });
});
