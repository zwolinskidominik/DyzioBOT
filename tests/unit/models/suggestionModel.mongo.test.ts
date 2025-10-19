import { SuggestionModel } from '../../../src/models/Suggestion';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Suggestion Model (real Mongo CRUD)', () => {
  beforeAll(async () => {
    await connectTestDb();
    await SuggestionModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('create, read, update, delete and enforce unique messageId', async () => {
    const created = await SuggestionModel.create({
      authorId: 'author1',
      guildId: 'guild1',
      messageId: 'msg-1',
      content: 'First suggestion',
    });
    expect(created.suggestionId).toBeTruthy();
    expect(created.upvotes).toEqual([]);

    const found = await SuggestionModel.findOne({ messageId: 'msg-1' });
    expect(found?.content).toBe('First suggestion');

    found!.upvotes.push('u1');
    found!.upvoteUsernames.push('User One');
    await found!.save();

    const updated = await SuggestionModel.findOne({ messageId: 'msg-1' });
    expect(updated?.upvotes).toEqual(['u1']);
    expect(updated?.upvoteUsernames).toEqual(['User One']);

    // unique index on messageId should reject duplicates
    await expect(
      SuggestionModel.create({
        authorId: 'author2',
        guildId: 'guild1',
        messageId: 'msg-1',
        content: 'Duplicate',
      })
    ).rejects.toThrow();

    await SuggestionModel.deleteOne({ messageId: 'msg-1' });
    const afterDelete = await SuggestionModel.findOne({ messageId: 'msg-1' });
    expect(afterDelete).toBeNull();
  });
});
