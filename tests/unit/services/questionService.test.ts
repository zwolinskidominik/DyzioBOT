import { QuestionModel } from '../../../src/models/Question';
import {
  getRandomQuestion,
  markUsed,
  addQuestion,
  listQuestions,
} from '../../../src/services/questionService';

beforeEach(async () => {
  await QuestionModel.deleteMany({});
});

/* ── addQuestion ──────────────────────────────────────────── */

describe('addQuestion', () => {
  it('creates a question with default values', async () => {
    const res = await addQuestion('author-1', 'Ulubiony kolor?');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe('Ulubiony kolor?');
    expect(res.data.disabled).toBe(false);
    expect(res.data.questionId).toBeTruthy();
  });

  it('stores reactions array', async () => {
    const res = await addQuestion('a1', 'Pytanie?', ['👍', '👎']);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.reactions).toEqual(['👍', '👎']);
  });
});

/* ── getRandomQuestion ────────────────────────────────────── */

describe('getRandomQuestion', () => {
  it('returns a random available question', async () => {
    await addQuestion('a1', 'Q1');
    await addQuestion('a1', 'Q2');
    const res = await getRandomQuestion();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(['Q1', 'Q2']).toContain(res.data.content);
  });

  it('fails with NO_QUESTIONS when all disabled', async () => {
    const q = await addQuestion('a1', 'Q1');
    if (q.ok) await markUsed(q.data.questionId);

    const res = await getRandomQuestion();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_QUESTIONS');
  });
});

/* ── markUsed ─────────────────────────────────────────────── */

describe('markUsed', () => {
  it('disables the question', async () => {
    const q = await addQuestion('a1', 'Q1');
    if (!q.ok) throw new Error('seed failed');

    const res = await markUsed(q.data.questionId);
    expect(res.ok).toBe(true);

    const doc = await QuestionModel.findOne({ questionId: q.data.questionId });
    expect(doc?.disabled).toBe(true);
  });

  it('fails with NOT_FOUND for unknown id', async () => {
    const res = await markUsed('nonexistent');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── listQuestions ─────────────────────────────────────────── */

describe('listQuestions', () => {
  it('returns all questions by default', async () => {
    await addQuestion('a1', 'Q1');
    const q2 = await addQuestion('a1', 'Q2');
    if (q2.ok) await markUsed(q2.data.questionId);

    const res = await listQuestions();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
  });

  it('returns only available when filtered', async () => {
    await addQuestion('a1', 'Q1');
    const q2 = await addQuestion('a1', 'Q2');
    if (q2.ok) await markUsed(q2.data.questionId);

    const res = await listQuestions(true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].content).toBe('Q1');
  });
});
