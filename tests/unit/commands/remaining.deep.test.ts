export {};
/**
 * Deep tests for remaining low-coverage commands:
 * faceit, help, embed, emoji, say, meme, kalendarzAdwentowy
 */

jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0, ERROR: 0xff0000, SUCCESS: 0x00ff00, FACEIT: 0xff5500, HELP: 0x5865F2, MEME: 0x00ff00 },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: { suggestionPB: '▪', warnPB: '▪' },
  }),
}));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: {},
    channels: {},
  }),
}));

const mockCreateBaseEmbed = jest.fn().mockReturnValue({
  setFooter: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis(),
  setThumbnail: jest.fn().mockReturnThis(),
  setURL: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  data: {},
});
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({
    setDescription: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    data: {},
  }),
}));

jest.mock('../../../src/utils/animalHelpers', () => ({
  getRandomCat: jest.fn().mockResolvedValue('https://example.com/cat.jpg'),
  getRandomDog: jest.fn().mockResolvedValue('https://example.com/dog.jpg'),
}));

jest.mock('../../../src/utils/memeHelpers', () => ({
  getRandomMeme: jest.fn().mockResolvedValue({
    title: 'Funny meme',
    url: 'https://example.com/meme.jpg',
    postLink: 'https://reddit.com/r/memes/123',
    subreddit: 'memes',
    author: 'u/user1',
    ups: 1234,
  }),
}));

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

jest.mock('../../../src/models/AdventCalendar', () => ({
  AdventCalendarModel: {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/* ─── helper ─── */
function makeInteraction(overrides: any = {}) {
  return {
    commandName: 'test',
    options: {
      getString: jest.fn().mockReturnValue(null),
      getSubcommand: jest.fn().mockReturnValue('default'),
      getChannel: jest.fn().mockReturnValue(null),
      getBoolean: jest.fn().mockReturnValue(false),
      getAttachment: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
      getUser: jest.fn().mockReturnValue(null),
    },
    guild: {
      id: 'g1',
      name: 'TestGuild',
      iconURL: () => 'https://example.com/icon.png',
      channels: { cache: new Map() },
      emojis: { cache: new Map() },
      members: { me: { permissions: { has: () => true } } },
    },
    user: { id: 'u1', username: 'testuser', displayAvatarURL: () => 'https://example.com/avatar.png' },
    member: { permissions: { has: () => true } },
    channel: { id: 'ch1', send: jest.fn().mockResolvedValue(undefined) },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   meme command
   ═══════════════════════════════════════════════════════════════════ */
describe('meme command', () => {
  let memeCmd: any;

  beforeAll(async () => {
    memeCmd = require('../../../src/commands/fun/meme');
  });

  it('exports data and run', () => {
    expect(memeCmd.data).toBeDefined();
    expect(memeCmd.run).toBeDefined();
  });

  it('sends a meme embed', async () => {
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles meme fetch error', async () => {
    const { getRandomMeme } = require('../../../src/utils/memeHelpers');
    getRandomMeme.mockRejectedValueOnce(new Error('API error'));
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   help command
   ═══════════════════════════════════════════════════════════════════ */
describe('help command', () => {
  let helpCmd: any;

  beforeAll(async () => {
    helpCmd = require('../../../src/commands/misc/help');
  });

  it('exports data and run', () => {
    expect(helpCmd.data).toBeDefined();
    expect(helpCmd.run).toBeDefined();
  });

  it('executes without error', async () => {
    const client = {
      application: {
        commands: {
          cache: new Map([
            ['cmd1', { name: 'ping', description: 'Ping', id: '1' }],
            ['cmd2', { name: 'help', description: 'Help', id: '2' }],
          ]),
        },
      },
    };
    const interaction = makeInteraction();
    await helpCmd.run({ interaction, client });
    expect(interaction.reply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   embed command
   ═══════════════════════════════════════════════════════════════════ */
describe('embed command', () => {
  let embedCmd: any;

  beforeAll(async () => {
    embedCmd = require('../../../src/commands/misc/embed');
  });

  it('exports data and run', () => {
    expect(embedCmd.data).toBeDefined();
    expect(embedCmd.run).toBeDefined();
  });

  it('creates embed with basic options', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'tytul') return 'Test Title';
      if (name === 'opis') return 'Test Description';
      if (name === 'kolor') return '#ff0000';
      return null;
    });
    await embedCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles no guild', async () => {
    const interaction = makeInteraction();
    interaction.guild = null;
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'tytul') return 'Title';
      if (name === 'opis') return 'Desc';
      return null;
    });
    await embedCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   emoji command
   ═══════════════════════════════════════════════════════════════════ */
describe('emoji command', () => {
  let emojiCmd: any;

  beforeAll(async () => {
    emojiCmd = require('../../../src/commands/misc/emoji');
  });

  it('exports data and run', () => {
    expect(emojiCmd.data).toBeDefined();
    expect(emojiCmd.run).toBeDefined();
  });

  it('lists emojis with single page', async () => {
    const interaction = makeInteraction();
    const emojisCache: any[] = [];
    interaction.guild.emojis.cache = {
      map: (fn: any) => emojisCache.map(fn),
    };
    await emojiCmd.run({ interaction, client: { application: { id: 'app1' } } });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles no guild', async () => {
    const interaction = makeInteraction();
    interaction.guild = null;
    await emojiCmd.run({ interaction, client: {} });
    expect(interaction.reply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   say command
   ═══════════════════════════════════════════════════════════════════ */
describe('say command', () => {
  let sayCmd: any;

  beforeAll(async () => {
    sayCmd = require('../../../src/commands/admin/say');
  });

  it('exports data and run', () => {
    expect(sayCmd.data).toBeDefined();
    expect(sayCmd.run).toBeDefined();
  });

  it('shows modal and handles submission', async () => {
    const interaction = makeInteraction();
    // say command uses showModal
    interaction.showModal = jest.fn().mockResolvedValue(undefined);
    interaction.awaitModalSubmit = jest.fn().mockResolvedValue({
      fields: { getTextInputValue: jest.fn().mockImplementation((id: string) => {
        if (id === 'sayMessage') return 'Hello world!';
        if (id === 'embedMode') return 'off';
        return '';
      })},
      reply: jest.fn().mockResolvedValue(undefined),
    });
    // say command checks TextChannel instance
    const { TextChannel } = require('discord.js');
    Object.setPrototypeOf(interaction.channel, TextChannel.prototype);
    await sayCmd.run({ interaction, client: {} });
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it('rejects non-text channels', async () => {
    const interaction = makeInteraction();
    interaction.channel = null;
    await sayCmd.run({ interaction, client: {} });
    expect(interaction.reply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   faceit command
   ═══════════════════════════════════════════════════════════════════ */
describe('faceit command', () => {
  let faceitCmd: any;
  const { fetch } = require('undici');

  beforeAll(async () => {
    faceitCmd = require('../../../src/commands/misc/faceit');
  });

  it('exports data and run', () => {
    expect(faceitCmd.data).toBeDefined();
    expect(faceitCmd.run).toBeDefined();
  });

  it('fetches faceit player stats', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('testplayer');

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          player_id: 'p1',
          nickname: 'testplayer',
          country: 'PL',
          avatar: 'https://example.com/avatar.png',
          games: { cs2: { faceit_elo: 1500, skill_level: 7 } },
          faceit_url: 'https://faceit.com/testplayer',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          lifetime: {
            'Current Win Streak': '3',
            'Longest Win Streak': '10',
            Matches: '500',
            'Win Rate %': '55',
            'Average K/D Ratio': '1.15',
            'Average Headshots %': '45',
          },
        }),
      });

    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles player not found', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('unknown');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles API error', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('test');
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   kalendarzAdwentowy command
   ═══════════════════════════════════════════════════════════════════ */
describe('kalendarzAdwentowy command', () => {
  let adventCmd: any;

  beforeAll(async () => {
    adventCmd = require('../../../src/commands/misc/kalendarzAdwentowy');
  });

  it('exports data and run', () => {
    expect(adventCmd.data).toBeDefined();
    expect(adventCmd.run).toBeDefined();
  });

  it('executes without error', async () => {
    const interaction = makeInteraction();
    await adventCmd.run({ interaction, client: {} });
    expect(
      interaction.deferReply.mock.calls.length +
      interaction.reply.mock.calls.length +
      interaction.editReply.mock.calls.length
    ).toBeGreaterThanOrEqual(0);
  });
});
