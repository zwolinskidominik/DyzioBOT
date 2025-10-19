import { SuggestionModel } from '../../../src/models/Suggestion';

jest.mock('@typegoose/typegoose', () => ({
  getModelForClass: (cls:any)=> {
    const docs:any[] = [];
    return {
      create: async (data:any)=> {
        if (docs.find(d=> d.messageId === data.messageId)) throw new Error('E11000 duplicate key error');
        const suggestionId = data.suggestionId || 'generated-'+ (docs.length+1);
        const doc = { suggestionId, upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], ...data, toObject(){ return this; } };
        docs.push(doc);
        return doc;
      }
    };
  },
  prop: ()=>{},
  index: ()=>()=>{},
}));

describe('models/Suggestion simulation', () => {
  test('auto generates suggestionId & defaults arrays empty', async () => {
    const created:any = await SuggestionModel.create({ authorId: 'a', guildId: 'g', messageId: 'm1', content: 'C' });
    expect(created.suggestionId).toMatch(/generated/);
    expect(created.upvotes).toEqual([]);
  });
  test('duplicate messageId throws', async () => {
    await SuggestionModel.create({ authorId: 'a', guildId: 'g', messageId: 'mX', content: 'C' });
    await expect(SuggestionModel.create({ authorId: 'b', guildId: 'g', messageId: 'mX', content: 'D' })).rejects.toThrow(/duplicate/);
  });
});
