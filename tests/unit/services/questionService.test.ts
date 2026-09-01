import { QuestionModel } from '../../../src/models/Question';
import { UsedQuestionModel } from '../../../src/models/UsedQuestion';
import {
  getRandomQuestion,
  markUsed,
  addQuestion,
  listQuestions,
} from '../../../src/services/questionService';

const GUILD_A = 'guild-a';
const GUILD_B = 'guild-b';

beforeEach(async () => {
  await QuestionModel.deleteMany({});
  await UsedQuestionModel.deleteMany({});
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
  it('returns a random available question for the guild', async () => {
    await addQuestion('a1', 'Q1');
    await addQuestion('a1', 'Q2');
    const res = await getRandomQuestion(GUILD_A);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(['Q1', 'Q2']).toContain(res.data.content);
  });

  it('fails with NO_QUESTIONS when the pool is empty', async () => {
    const res = await getRandomQuestion(GUILD_A);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_QUESTIONS');
  });

  it('does not repeat a question already used on this guild', async () => {
    await addQuestion('a1', 'Q1');
    const q2 = await addQuestion('a1', 'Q2');
    if (q2.ok) await markUsed(GUILD_A, q2.data.questionId);

    const res = await getRandomQuestion(GUILD_A);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe('Q1');
  });

  it('lets another guild draw a question already used on a different guild', async () => {
    const q1 = await addQuestion('a1', 'Q1');
    if (q1.ok) await markUsed(GUILD_A, q1.data.questionId);

    const res = await getRandomQuestion(GUILD_B);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe('Q1');
  });

  it('cycles (resets) for a guild once it has used the entire shared pool', async () => {
    const q1 = await addQuestion('a1', 'Q1');
    if (q1.ok) await markUsed(GUILD_A, q1.data.questionId);

    const res = await getRandomQuestion(GUILD_A);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe('Q1');

    const usedCount = await UsedQuestionModel.countDocuments({ guildId: GUILD_A });
    expect(usedCount).toBe(0);
  });
});

/* ── markUsed ─────────────────────────────────────────────── */

describe('markUsed', () => {
  it('records per-guild usage without disabling the question globally', async () => {
    const q = await addQuestion('a1', 'Q1');
    if (!q.ok) throw new Error('seed failed');

    const res = await markUsed(GUILD_A, q.data.questionId);
    expect(res.ok).toBe(true);

    const doc = await QuestionModel.findOne({ questionId: q.data.questionId });
    expect(doc?.disabled).toBe(false);

    const used = await UsedQuestionModel.findOne({ guildId: GUILD_A, questionId: q.data.questionId });
    expect(used).toBeTruthy();
  });

  it('fails with NOT_FOUND for unknown id', async () => {
    const res = await markUsed(GUILD_A, 'nonexistent');
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
    if (q2.ok) await markUsed(GUILD_A, q2.data.questionId);

    const res = await listQuestions();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
  });

  it('returns only non-disabled when filtered', async () => {
    await addQuestion('a1', 'Q1');
    const q2 = await addQuestion('a1', 'Q2');
    if (q2.ok) await markUsed(GUILD_A, q2.data.questionId);

    const res = await listQuestions(true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // markUsed nie wyłącza już pytania globalnie — obie pozostają aktywne w puli
    expect(res.data).toHaveLength(2);
  });
});
