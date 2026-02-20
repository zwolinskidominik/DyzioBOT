import { BirthdayModel, BirthdayDocument } from '../models/Birthday';
import { BirthdayConfigurationModel } from '../models/BirthdayConfiguration';
import type { IParsedDateResult } from '../interfaces/Birthday';
import { ServiceResult, ok, fail } from '../types/serviceResult';

/* ── Constants ───────────────────────────────────────────────────── */

const DATE_PATTERN_WITH_YEAR = /^\d{2}-\d{2}-\d{4}$/;
const DATE_PATTERN_WITHOUT_YEAR = /^\d{2}-\d{2}$/;

/* ── Result types ────────────────────────────────────────────────── */

export interface BirthdayData {
  date: Date;
  yearSpecified: boolean;
  active: boolean;
}

export interface UpcomingBirthdayEntry {
  userId: string;
  date: Date;
  yearSpecified: boolean;
  nextBirthday: Date;
  daysUntil: number;
  age: number | null;
}

export interface TodayBirthdayEntry {
  userId: string;
}

export interface BirthdayConfigData {
  guildId: string;
  birthdayChannelId: string;
  roleId?: string;
  message?: string;
  enabled?: boolean;
}

/* ── Date parsing (pure, shared between commands) ────────────────── */

export function parseBirthdayDate(dateString: string): IParsedDateResult {
  let date: Date;
  let yearSpecified = true;

  if (DATE_PATTERN_WITH_YEAR.test(dateString)) {
    const [day, month, year] = dateString.split('-');
    date = new Date(`${year}-${month}-${day}`);
  } else if (DATE_PATTERN_WITHOUT_YEAR.test(dateString)) {
    const [day, month] = dateString.split('-');
    date = new Date(`1970-${month}-${day}`);
    yearSpecified = false;
  } else {
    return {
      isValid: false,
      date: null,
      yearSpecified: false,
      errorMessage: 'Niepoprawny format daty. Użyj formatu `DD-MM-YYYY` lub `DD-MM`.',
    };
  }

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      date: null,
      yearSpecified: false,
      errorMessage: 'Niepoprawna data. Użyj prawidłowej daty w formacie `DD-MM-YYYY` lub `DD-MM`.',
    };
  }

  return { isValid: true, date, yearSpecified };
}

/* ── Service functions ───────────────────────────────────────────── */

export async function setBirthday(params: {
  guildId: string;
  userId: string;
  dateString: string;
}): Promise<ServiceResult<BirthdayData>> {
  const { guildId, userId, dateString } = params;

  const parsed = parseBirthdayDate(dateString);
  if (!parsed.isValid || !parsed.date) {
    return fail('INVALID_DATE', parsed.errorMessage || 'Niepoprawna data.');
  }

  const filter = { userId, guildId };
  const update = { date: parsed.date, yearSpecified: parsed.yearSpecified, active: true };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const doc = (await BirthdayModel.findOneAndUpdate(
    filter,
    update,
    options
  ).exec()) as BirthdayDocument;

  return ok({
    date: doc.date,
    yearSpecified: doc.yearSpecified,
    active: doc.active,
  });
}

export async function getBirthday(params: {
  guildId: string;
  userId: string;
}): Promise<ServiceResult<BirthdayData | null>> {
  const { guildId, userId } = params;

  const doc = await BirthdayModel.findOne({
    userId,
    guildId,
    active: true,
  }).exec();

  if (!doc) {
    return ok(null);
  }

  return ok({
    date: doc.date,
    yearSpecified: doc.yearSpecified,
    active: doc.active,
  });
}

export async function getUpcomingBirthdays(params: {
  guildId: string;
  limit?: number;
}): Promise<ServiceResult<UpcomingBirthdayEntry[]>> {
  const { guildId, limit = 10 } = params;

  const birthdays = await BirthdayModel.find({ guildId, active: true })
    .sort({ date: 1 })
    .exec();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries: UpcomingBirthdayEntry[] = [];

  for (const birthday of birthdays) {
    const birthdayDate = new Date(birthday.date);
    const nextBirthday = new Date(
      today.getFullYear(),
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );

    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcNext = Date.UTC(
      nextBirthday.getFullYear(),
      nextBirthday.getMonth(),
      nextBirthday.getDate()
    );

    const daysUntil = Math.round((utcNext - utcToday) / (1000 * 60 * 60 * 24));
    const age = birthday.yearSpecified
      ? nextBirthday.getFullYear() - birthdayDate.getFullYear()
      : null;

    entries.push({
      userId: birthday.userId,
      date: birthday.date,
      yearSpecified: birthday.yearSpecified,
      nextBirthday,
      daysUntil,
      age,
    });
  }

  entries.sort((a, b) => a.daysUntil - b.daysUntil);

  return ok(entries.slice(0, limit));
}

export async function getTodayBirthdays(params: {
  guildId: string;
}): Promise<ServiceResult<TodayBirthdayEntry[]>> {
  const { guildId } = params;

  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const birthdays = await BirthdayModel.find({ guildId, active: true }).exec();

  const todayEntries = birthdays
    .filter((b) => b.day === day && b.month === month)
    .map((b) => ({ userId: b.userId }));

  return ok(todayEntries);
}

export async function getBirthdayConfigs(): Promise<ServiceResult<BirthdayConfigData[]>> {
  const configs = await BirthdayConfigurationModel.find({}).lean().exec();
  return ok(
    configs.map((c) => ({
      guildId: c.guildId,
      birthdayChannelId: c.birthdayChannelId,
      roleId: c.roleId,
      message: c.message,
      enabled: c.enabled,
    }))
  );
}

/* ── Helpers (pure, exported for commands) ───────────────────────── */

export function getDaysForm(days: number): string {
  return days === 1 ? 'dzień' : 'dni';
}

/**
 * Build the confirmation message shown after setting a birthday.
 * Shared by `/birthday-remember` and `/birthday-set-user`.
 */
export function formatBirthdayConfirmation(
  birthdayEmoji: string,
  userId: string,
  date: Date,
  yearSpecified: boolean,
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthdayDate = new Date(date);
  const nextBirthday = new Date(
    today.getFullYear(),
    birthdayDate.getMonth(),
    birthdayDate.getDate(),
  );

  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcNextBirthday = Date.UTC(
    nextBirthday.getFullYear(),
    nextBirthday.getMonth(),
    nextBirthday.getDate(),
  );

  const diffDays = Math.round((utcNextBirthday - utcToday) / (1000 * 60 * 60 * 24));

  const formattedDate = nextBirthday.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  let ageMessage = 'kolejne';
  if (yearSpecified) {
    ageMessage = `${nextBirthday.getFullYear() - birthdayDate.getFullYear()}`;
  }

  if (diffDays === 0) {
    return `Zanotowano, **${ageMessage}** urodziny <@!${userId}> są dziś! Wszystkiego najlepszego! ${birthdayEmoji}`;
  }

  return yearSpecified
    ? `Zanotowano, **${ageMessage}** urodziny <@!${userId}> już za **${diffDays}** ${getDaysForm(diffDays)}, **${formattedDate}** 🎂.`
    : `Zanotowano, **Następne** urodziny <@!${userId}> są za **${diffDays}** ${getDaysForm(diffDays)}, **${formattedDate}** 🎂.`;
}
