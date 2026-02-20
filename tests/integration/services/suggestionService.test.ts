import { SuggestionModel } from '../../../src/models/Suggestion';
import { SuggestionConfigurationModel } from '../../../src/models/SuggestionConfiguration';
import {
  isSuggestionChannel,
  createSuggestion,
  vote,
} from '../../../src/services/suggestionService';

const GID = 'guild-1';
const CHANNEL = 'chan-1';
const AUTHOR = 'author-1';

/* ================================================================ */
/*  isSuggestionChannel                                              */
/* ================================================================ */
describe('isSuggestionChannel', () => {
  it('returns true when channelId matches config', async () => {
    await SuggestionConfigurationModel.create({
      guildId: GID,
      suggestionChannelId: CHANNEL,
      enabled: true,
    });

    const result = await isSuggestionChannel({ guildId: GID, channelId: CHANNEL });
    expect(result).toBe(true);
  });

  it('returns false when channelId does not match', async () => {
    await SuggestionConfigurationModel.create({
      guildId: GID,
      suggestionChannelId: CHANNEL,
      enabled: true,
    });

    const result = await isSuggestionChannel({ guildId: GID, channelId: 'other-chan' });
    expect(result).toBe(false);
  });

  it('returns false when no config exists for the guild', async () => {
    const result = await isSuggestionChannel({ guildId: GID, channelId: CHANNEL });
    expect(result).toBe(false);
  });
});

/* ================================================================ */
/*  createSuggestion                                                 */
/* ================================================================ */
describe('createSuggestion', () => {
  it('creates a suggestion and returns suggestionId', async () => {
    const res = await createSuggestion({
      authorId: AUTHOR,
      guildId: GID,
      messageId: 'msg-1',
      content: 'Add dark mode',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.suggestionId).toBeDefined();
    expect(res.data.messageId).toBe('msg-1');

    const doc = await SuggestionModel.findOne({ messageId: 'msg-1' });
    expect(doc?.content).toBe('Add dark mode');
  });

  it('returns EMPTY_CONTENT for blank content', async () => {
    const res = await createSuggestion({
      authorId: AUTHOR,
      guildId: GID,
      messageId: 'msg-2',
      content: '   ',
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('EMPTY_CONTENT');
  });
});

/* ================================================================ */
/*  vote                                                             */
/* ================================================================ */
describe('vote', () => {
  let suggestionId: string;

  beforeEach(async () => {
    const res = await createSuggestion({
      authorId: AUTHOR,
      guildId: GID,
      messageId: `msg-${Date.now()}`,
      content: 'Test suggestion',
    });
    if (!res.ok) throw new Error('Setup failed');
    suggestionId = res.data.suggestionId;
  });

  it('records an upvote', async () => {
    const res = await vote({
      suggestionId,
      odId: 'voter-1',
      username: 'Voter1',
      direction: 'upvote',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.upvotes).toContain('voter-1');
    expect(res.data.downvotes).toHaveLength(0);
  });

  it('records a downvote', async () => {
    const res = await vote({
      suggestionId,
      odId: 'voter-2',
      username: 'Voter2',
      direction: 'downvote',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.downvotes).toContain('voter-2');
  });

  it('returns ALREADY_VOTED when user votes twice', async () => {
    await vote({ suggestionId, odId: 'voter-1', username: 'V1', direction: 'upvote' });

    const res = await vote({ suggestionId, odId: 'voter-1', username: 'V1', direction: 'downvote' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('ALREADY_VOTED');
  });

  it('returns NOT_FOUND for invalid suggestionId', async () => {
    const res = await vote({
      suggestionId: 'nonexistent',
      odId: 'voter-1',
      username: 'V1',
      direction: 'upvote',
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });

  it('allows different users to vote on the same suggestion', async () => {
    await vote({ suggestionId, odId: 'v1', username: 'V1', direction: 'upvote' });
    await vote({ suggestionId, odId: 'v2', username: 'V2', direction: 'downvote' });

    const res = await vote({ suggestionId, odId: 'v3', username: 'V3', direction: 'upvote' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.upvotes).toHaveLength(2);
    expect(res.data.downvotes).toHaveLength(1);
  });
});
