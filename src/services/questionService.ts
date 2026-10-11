import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';
import { QuestionModel } from '../models/Question';
import { UsedQuestionModel } from '../models/UsedQuestion';

/* ── Types ────────────────────────────────────────────────── */

export interface QuestionData {
  questionId: string;
  authorId: string;
  content: string;
  reactions: string[];
  disabled: boolean;
}

/* ── Service functions ────────────────────────────────────── */

/**
 * Losuje pytanie dostępne dla DANEGO serwera. Pula pytań (Question) jest
 * globalna — dodawana przez właściciela bota dla wszystkich serwerów — ale
 * każdy serwer śledzi swoje użycie osobno przez UsedQuestion (guildId +
 * questionId), więc pytania nigdy nie powtarzają się na tym samym serwerze.
 *
 * Wyczerpana pula NIE resetuje historii — wysłane pytanie zostaje wysłane na
 * zawsze. Przywrócić je można tylko ręcznie (dashboard → „Przywróć”).
 */
export async function getRandomQuestion(guildId: string): Promise<ServiceResult<QuestionData>> {
  // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje ręcznie pisane
  // operatory — bez tego CAŁE losowanie pytania dnia rzuca CastError.
  const activePool = await QuestionModel.find({ disabled: mongoose.trusted({ $ne: true }) }).lean();
  if (activePool.length === 0) {
    return fail('NO_QUESTIONS', 'Brak dostępnych pytań.');
  }

  const usedIds = new Set(await UsedQuestionModel.find({ guildId }).distinct('questionId'));
  // Pytanie bez zapisanego questionId nie da się oznaczyć jako wysłane — wysyłane byłoby
  // w kółko. ensureQuestionIds() (start bota) uzupełnia takie ID; tu tylko zabezpieczenie.
  const available = activePool.filter((q) => hasQuestionId(q.questionId) && !usedIds.has(q.questionId));

  if (available.length === 0) {
    return fail('POOL_EXHAUSTED', 'Wszystkie pytania zostały już wysłane na tym serwerze.');
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  return ok(toData(pick));
}

/**
 * Oznacza pytanie jako użyte NA DANYM SERWERZE (nie globalnie — inne
 * serwery nadal mogą je wylosować).
 */
export async function markUsed(guildId: string, questionId: string): Promise<ServiceResult<void>> {
  // Pusty/undefined questionId zostałby wycięty z filtra i exists() trafiłby w DOWOLNE pytanie.
  if (!hasQuestionId(questionId)) return fail('NOT_FOUND', 'Nie znaleziono pytania.');
  const exists = await QuestionModel.exists({ questionId });
  if (!exists) return fail('NOT_FOUND', 'Nie znaleziono pytania.');

  await UsedQuestionModel.updateOne(
    { guildId, questionId },
    { $set: { usedAt: new Date() } },
    { upsert: true },
  );
  return ok(undefined);
}

/**
 * Add a new question.
 */
export async function addQuestion(
  authorId: string,
  content: string,
  reactions: string[] = [],
): Promise<ServiceResult<QuestionData>> {
  const doc = await QuestionModel.create({ authorId, content, reactions });
  return ok(toData(doc));
}

/**
 * Get all questions (optionally filtered by disabled state).
 */
export async function listQuestions(
  onlyAvailable = false,
): Promise<ServiceResult<QuestionData[]>> {
  const filter = onlyAvailable ? { disabled: mongoose.trusted({ $ne: true }) } : {};
  const docs = await QuestionModel.find(filter).lean();
  return ok(docs.map(toData));
}

/**
 * Nadaje stałe questionId pytaniom, które go nie mają zapisanego w bazie (stare wpisy).
 *
 * Bez tego Mongoose przy każdym odczycie dokumentu dopisuje w pamięci NOWY losowy UUID
 * (default w modelu), więc takie pytanie nigdy nie pasuje do historii wysłanych
 * i wygląda na dostępne. Działa na surowej kolekcji, żeby default modelu nie maskował braku.
 */
export async function ensureQuestionIds(): Promise<ServiceResult<number>> {
  try {
    const missing = await QuestionModel.collection
      .find({ questionId: { $in: [null, ''] } }, { projection: { _id: 1 } })
      .toArray();

    let fixed = 0;
    for (const { _id } of missing) {
      const res = await QuestionModel.collection.updateOne(
        { _id, questionId: { $in: [null, ''] } },
        { $set: { questionId: randomUUID() } },
      );
      fixed += res.modifiedCount;
    }
    return ok(fixed);
  } catch (err) {
    logger.error(`ensureQuestionIds failed: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się uzupełnić ID pytań.');
  }
}

/* ── Internal helpers ─────────────────────────────────────── */

function hasQuestionId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toData(doc: any): QuestionData {
  return {
    questionId: doc.questionId,
    authorId: doc.authorId,
    content: doc.content,
    reactions: doc.reactions ?? [],
    disabled: doc.disabled ?? false,
  };
}
