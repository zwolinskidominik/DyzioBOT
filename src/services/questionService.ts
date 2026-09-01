import mongoose from 'mongoose';
import { ServiceResult, ok, fail } from '../types/serviceResult';
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
 * questionId), więc pytania nie powtarzają się na tym samym serwerze, dopóki
 * nie przejdzie całej wspólnej puli. Gdy serwer wyczerpie pulę, cykl dla
 * niego zaczyna się od nowa (reszta serwerów tego nie widzi).
 */
export async function getRandomQuestion(guildId: string): Promise<ServiceResult<QuestionData>> {
  // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje ręcznie pisane
  // operatory — bez tego CAŁE losowanie pytania dnia rzuca CastError.
  const activePool = await QuestionModel.find({ disabled: mongoose.trusted({ $ne: true }) }).lean();
  if (activePool.length === 0) {
    return fail('NO_QUESTIONS', 'Brak dostępnych pytań.');
  }

  const usedIds = new Set(await UsedQuestionModel.find({ guildId }).distinct('questionId'));
  let available = activePool.filter((q) => !usedIds.has(q.questionId));

  if (available.length === 0) {
    // Serwer wyczerpał całą pulę — zaczynamy cykl od nowa tylko dla niego.
    await UsedQuestionModel.deleteMany({ guildId });
    available = activePool;
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  return ok(toData(pick));
}

/**
 * Oznacza pytanie jako użyte NA DANYM SERWERZE (nie globalnie — inne
 * serwery nadal mogą je wylosować).
 */
export async function markUsed(guildId: string, questionId: string): Promise<ServiceResult<void>> {
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

/* ── Internal helpers ─────────────────────────────────────── */

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
