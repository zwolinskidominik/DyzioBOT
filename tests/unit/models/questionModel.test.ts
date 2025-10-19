import { QuestionModel } from '../../../src/models/Question';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Question Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await QuestionModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates with auto questionId and empty reactions', async () => {
    const q = await QuestionModel.create({ authorId: 'user1', content: 'What is life?' });
    expect(q.questionId).toBeDefined();
    expect(q.reactions).toEqual([]);
  });

  it('enforces unique content', async () => {
    await QuestionModel.create({ authorId: 'user1', content: 'Dup question' });
    await expect(
      QuestionModel.create({ authorId: 'user2', content: 'Dup question' })
    ).rejects.toThrow(/duplicate key/i);
  });
});
