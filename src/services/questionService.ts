import { ServiceResult, ok, fail } from '../types/serviceResult';
import { QuestionModel } from '../models/Question';

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
 * Get a random available (non-disabled) question.
 */
export async function getRandomQuestion(): Promise<ServiceResult<QuestionData>> {
  const available = await QuestionModel.find({ disabled: { $ne: true } }).lean();
  if (available.length === 0) {
    return fail('NO_QUESTIONS', 'Brak dostępnych pytań.');
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  return ok(toData(pick));
}

/**
 * Mark a question as used (disabled).
 */
export async function markUsed(questionId: string): Promise<ServiceResult<void>> {
  const doc = await QuestionModel.findOneAndUpdate(
    { questionId },
    { disabled: true },
    { new: true },
  );
  if (!doc) return fail('NOT_FOUND', 'Nie znaleziono pytania.');
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
  const filter = onlyAvailable ? { disabled: { $ne: true } } : {};
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
