/**
 * Tests for message-related events:
 * - messageCreate/createSuggestions, musicCommands, trackXp
 * - messageDelete/logMessageDelete
 * - messageReactionAdd/reactionRoleAdd
 * - messageReactionRemove/reactionRoleRemove
 * - messageUpdate/logMessageEdit
 */

/* ── mocks ───────────────────────────────────────────────── */

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
  truncate: jest.fn((s: string, len: number) => s?.slice(0, len) ?? ''),
}));
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/suggestionService', () => ({
  isSuggestionChannel: jest.fn().mockResolvedValue(false),
  createSuggestion: jest.fn().mockResolvedValue({ ok: true, data: { suggestionId: 's1' } }),
  deleteSuggestionByMessageId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setTimestamp: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
  formatResults: jest.fn().mockReturnValue('results'),
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: { suggestion: { upvote: '👍', downvote: '👎' } },
  }),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0, MUSIC: 0x00ff00, MUSIC_PAUSE: 0xffff00, MUSIC_SUCCESS: 0x00ff00 },
}));

jest.mock('../../../src/services/musicPlayer', () => ({
  getMusicPlayer: jest.fn().mockReturnValue(null),
  canUseMusic: jest.fn().mockResolvedValue({ allowed: false, reason: 'disabled' }),
  canPlayInChannel: jest.fn().mockResolvedValue({ allowed: true }),
  QueueMetadata: {},
}));

jest.mock('../../../src/models/MusicConfig', () => ({
  MusicConfigModel: { findOne: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../../../src/services/xpService', () => ({
  trackMessage: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../src/cache/monthlyStatsCache', () => ({
  __esModule: true,
  default: { addMessage: jest.fn(), addVoiceMinutes: jest.fn() },
}));

jest.mock('../../../src/models/ReactionRole', () => ({
  ReactionRoleModel: { findOne: jest.fn().mockResolvedValue(null) },
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { mockClient, mockGuild, mockTextChannel, mockMessage, mockUser, mockGuildMember } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── messageCreate / createSuggestions ────────────────────── */

describe('messageCreate / createSuggestions', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageCreate/createSuggestions')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores bot messages', async () => {
    const msg = mockMessage({ author: mockUser({ bot: true }) });
    await run(msg);
    const { isSuggestionChannel } = require('../../../src/services/suggestionService');
    expect(isSuggestionChannel).not.toHaveBeenCalled();
  });

  it('ignores DM messages', async () => {
    const msg = mockMessage({ guild: null });
    msg.channel = { ...msg.channel, type: 1 }; // DM
    await run(msg);
    const { isSuggestionChannel } = require('../../../src/services/suggestionService');
    expect(isSuggestionChannel).not.toHaveBeenCalled();
  });

  it('ignores non-suggestion channels', async () => {
    const msg = mockMessage();
    msg.channel.type = 0;
    msg.client = mockClient();
    await run(msg);
    // isSuggestionChannel returns false so no suggestion created
    const { createSuggestion } = require('../../../src/services/suggestionService');
    expect(createSuggestion).not.toHaveBeenCalled();
  });
});

/* ── messageCreate / musicCommands ────────────────────────── */

describe('messageCreate / musicCommands', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageCreate/musicCommands')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-prefix messages', async () => {
    const msg = mockMessage({ content: 'hello world' });
    await run(msg);
    expect(msg.reply).not.toHaveBeenCalled();
  });

  it('ignores bot messages', async () => {
    const msg = mockMessage({ content: '!play test' });
    msg.author.bot = true;
    await run(msg);
    expect(msg.reply).not.toHaveBeenCalled();
  });

  it('ignores non-music commands', async () => {
    const msg = mockMessage({ content: '!ping' });
    await run(msg);
    expect(msg.reply).not.toHaveBeenCalled();
  });

  it('replies when player not initialized', async () => {
    const msg = mockMessage({ content: '!play test' });
    msg.member = mockGuildMember();
    msg.member.roles = { cache: new Collection() };
    const { getMusicPlayer } = require('../../../src/services/musicPlayer');
    getMusicPlayer.mockReturnValue(null);

    await run(msg);
    expect(msg.reply).toHaveBeenCalledWith('❌ Odtwarzacz muzyki nie jest zainicjalizowany.');
  });
});

/* ── messageCreate / trackXp ──────────────────────────────── */

describe('messageCreate / trackXp', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageCreate/trackXp')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores bot messages', async () => {
    const msg = mockMessage({ author: mockUser({ bot: true }) });
    await run(msg);
    const { trackMessage } = require('../../../src/services/xpService');
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('ignores messages without guild', async () => {
    const msg = mockMessage({ guild: null });
    msg.author.bot = false;
    await run(msg);
    const { trackMessage } = require('../../../src/services/xpService');
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('calls trackMessage for valid messages', async () => {
    const msg = mockMessage();
    msg.author.bot = false;
    await run(msg);
    const { trackMessage } = require('../../../src/services/xpService');
    expect(trackMessage).toHaveBeenCalledWith(
      msg.guild.id,
      msg.author.id,
      msg.channelId,
      msg.member,
    );
  });

  it('adds monthly stats when tracked', async () => {
    const { trackMessage } = require('../../../src/services/xpService');
    trackMessage.mockResolvedValueOnce(true);

    const monthlyStatsCache = require('../../../src/cache/monthlyStatsCache').default;
    const msg = mockMessage();
    msg.author.bot = false;
    await run(msg);
    expect(monthlyStatsCache.addMessage).toHaveBeenCalled();
  });
});

/* ── messageDelete / logMessageDelete ─────────────────────── */

describe('messageDelete / logMessageDelete', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageDelete/logMessageDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores messages without guild', async () => {
    const msg = mockMessage({ guild: null });
    const client = mockClient();
    await run(msg, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('ignores bot messages', async () => {
    const msg = mockMessage();
    msg.author.bot = true;
    const client = mockClient();
    await run(msg, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('logs deletion for user messages', async () => {
    const msg = mockMessage();
    msg.author.bot = false;
    const client = mockClient();
    await run(msg, client);
    expect(sendLog).toHaveBeenCalledWith(client, msg.guild.id, 'messageDelete', expect.any(Object), expect.any(Object));
  });
});

/* ── messageReactionAdd / reactionRoleAdd ─────────────────── */

describe('messageReactionAdd / reactionRoleAdd', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageReactionAdd/reactionRoleAdd')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores bot reactions', async () => {
    const reaction = {
      partial: false,
      fetch: jest.fn(),
      emoji: { toString: () => '👍' },
      message: { guild: mockGuild(), id: 'msg-1' },
    };
    const user = mockUser({ bot: true });
    await run(reaction, user);
    const { ReactionRoleModel } = require('../../../src/models/ReactionRole');
    expect(ReactionRoleModel.findOne).not.toHaveBeenCalled();
  });

  it('does nothing when no reaction role config', async () => {
    const guild = mockGuild();
    const reaction = {
      partial: false,
      fetch: jest.fn(),
      emoji: { toString: () => '👍' },
      message: { guild, id: 'msg-1' },
    };
    const user = mockUser({ bot: false });
    user.partial = false;
    await run(reaction, user);
    // No role.add called since model returns null
  });
});

/* ── messageReactionRemove / reactionRoleRemove ───────────── */

describe('messageReactionRemove / reactionRoleRemove', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageReactionRemove/reactionRoleRemove')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores bot reactions', async () => {
    const reaction = {
      partial: false,
      fetch: jest.fn(),
      emoji: { toString: () => '👍' },
      message: { guild: mockGuild(), id: 'msg-1' },
    };
    const user = mockUser({ bot: true });
    await run(reaction, user);
    const { ReactionRoleModel } = require('../../../src/models/ReactionRole');
    expect(ReactionRoleModel.findOne).not.toHaveBeenCalled();
  });
});

/* ── messageUpdate / logMessageEdit ───────────────────────── */

describe('messageUpdate / logMessageEdit', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageUpdate/logMessageEdit')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores messages without guild', async () => {
    const msg = mockMessage({ guild: null });
    const client = mockClient();
    await run(msg, msg, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('ignores bot edits', async () => {
    const msg = mockMessage();
    msg.author.bot = true;
    const client = mockClient();
    await run(msg, msg, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('ignores when content unchanged', async () => {
    const msg = mockMessage({ content: 'same' });
    msg.author.bot = false;
    const client = mockClient();
    await run(msg, msg, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('logs edit when content changed', async () => {
    const oldMsg = mockMessage({ content: 'old text' });
    oldMsg.author.bot = false;
    const newMsg = mockMessage({ content: 'new text' });
    newMsg.author.bot = false;
    newMsg.url = 'https://discord.com/...';
    const client = mockClient();
    await run(oldMsg, newMsg, client);
    expect(sendLog).toHaveBeenCalledWith(client, newMsg.guild.id, 'messageEdit', expect.any(Object), expect.any(Object));
  });
});
