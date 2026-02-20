import { FortuneModel, FortuneUsageModel, FortuneUsageDocument } from '../models/Fortune';
import type { IFortune } from '../interfaces/Models';
import { ServiceResult, ok, fail } from '../types/serviceResult';

/* ── Constants ───────────────────────────────────────────────────── */

export const DAILY_FORTUNE_LIMIT = 2;

/* ── Result types ────────────────────────────────────────────────── */

export interface GetFortuneData {
  fortune: string;
  remainingToday: number;
}

export interface FortuneRateLimitData {
  hoursLeft: number;
  minutesLeft: number;
}

/* ── Service functions ───────────────────────────────────────────── */

/**
 * Draw a random fortune for the user. Each user gets DAILY_FORTUNE_LIMIT per day.
 * The drawn fortune is consumed (deleted from pool).
 */
export async function getFortune(params: {
  userId: string;
}): Promise<ServiceResult<GetFortuneData>> {
  const { userId } = params;

  const fortunes: IFortune[] = await FortuneModel.find<IFortune>().lean().exec();
  if (!fortunes.length) {
    return fail('NO_FORTUNES', 'Brak wróżb w bazie danych! Skontaktuj się z administratorem.');
  }

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let usage = (await FortuneUsageModel.findOne({
    userId,
    targetId: userId,
  }).exec()) as FortuneUsageDocument | null;

  if (!usage) {
    usage = new FortuneUsageModel({
      userId,
      targetId: userId,
      lastUsedDay: today,
      dailyUsageCount: 0,
    }) as FortuneUsageDocument;
  }

  const lastUsedDay = new Date(usage.lastUsedDay);
  lastUsedDay.setHours(0, 0, 0, 0);

  if (today.getTime() > lastUsedDay.getTime()) {
    usage.dailyUsageCount = 0;
    usage.lastUsedDay = today;
  }

  if (usage.dailyUsageCount >= DAILY_FORTUNE_LIMIT) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const msUntil = tomorrow.getTime() - now.getTime();
    const h = Math.floor(msUntil / (1000 * 60 * 60));
    const m = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));

    return fail(
      'RATE_LIMIT',
      `Wykorzystałeś już limit wróżb na dzisiaj! Następne wróżby będą dostępne za ${h}h i ${m} min.`
    );
  }

  const random = fortunes[Math.floor(Math.random() * fortunes.length)];

  usage.dailyUsageCount += 1;
  usage.lastUsed = now;
  await usage.save();

  await FortuneModel.deleteOne({ content: random.content }).exec();

  const remainingToday = DAILY_FORTUNE_LIMIT - usage.dailyUsageCount;

  return ok({
    fortune: random.content || 'Brak przepowiedni',
    remainingToday,
  });
}
