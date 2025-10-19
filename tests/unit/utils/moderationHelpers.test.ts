import type { GuildMember, User, Guild } from 'discord.js';

jest.mock('pretty-ms', () => ({ __esModule: true, default: (ms: number) => `${Math.round(ms/60000)}m` }));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn((opts: any) => {
    const fields: any[] = [];
    return {
      data: { description: opts.description, footer: { text: opts.footerText, icon_url: opts.footerIcon }, thumbnail: { url: opts.thumbnail } },
      addFields: (...f: any[]) => { fields.push(...f); return (embed as any); },
      get fields() { return fields; }
    } as any;
    var embed;
  }),
}));

jest.mock('../../../src/utils/roleHelpers', () => ({
  checkRole: jest.fn(() => true),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn() },
}));

const { checkRole } = require('../../../src/utils/roleHelpers');
const logger = require('../../../src/utils/logger').default;

const {
  createModErrorEmbed,
  createModSuccessEmbed,
  checkModPermissions,
  validateDuration,
  formatDuration,
  findBannedUser,
} = require('../../../src/utils/moderationHelpers');

function makeUser(id: string): User {
  return {
    id,
    displayAvatarURL: () => `https://cdn.example/avatar/${id}.png`,
  } as any;
}

function makeMember(id: string, position: number): GuildMember {
  return {
    id,
    roles: { highest: { position } },
    guild: { ownerId: 'owner' },
  } as any;
}

describe('createModErrorEmbed', () => {
  test('wraps description bold and sets footer', () => {
    const embed = createModErrorEmbed('Błąd akcji', 'Serwer');
    expect(embed.data.description).toBe('**Błąd akcji**');
  expect(embed.data.footer?.text).toBe('Serwer');
  });

  test('empty description safe', () => {
    const embed = createModErrorEmbed('', 'X');
    expect(embed.data.description).toBe('');
  });
});

describe('createModSuccessEmbed', () => {
  test('ban includes moderator and reason (no duration)', () => {
    const target = makeUser('100');
    const mod = makeUser('200');
    const embed: any = createModSuccessEmbed('ban', target, mod, null, 'GuildName', 'Spam');
    expect(embed.data.description).toContain('Zbanowano');
    expect(embed.fields.find((f: any) => f.name === 'Moderator').value).toBe('<@!200>');
    expect(embed.fields.find((f: any) => f.name === 'Powód').value).toBe('Spam');
  });

  test('mute with duration adds Czas field', () => {
    const target = makeUser('101');
    const mod = makeUser('201');
    const embed: any = createModSuccessEmbed('mute', target, mod, 'icon', 'GuildName', 'Flood', '15m');
    expect(embed.fields.find((f: any) => f.name === 'Czas').value).toBe('15m');
  });

  test('unban omits reason field even if provided', () => {
    const target = makeUser('103');
    const mod = makeUser('203');
    const embed: any = createModSuccessEmbed('unban', target, mod, undefined, 'GuildName', 'Ignoruj');
    expect(embed.fields.find((f: any) => f.name === 'Powód')).toBeUndefined();
  });
});

describe('checkModPermissions', () => {
  test('returns false when botMember missing', () => {
    const target = makeMember('t', 1);
    const requester = makeMember('r', 2);
    expect(checkModPermissions(target, requester, null as any)).toBe(false);
  });

  test('delegates to checkRole when bot present', () => {
    (checkRole as jest.Mock).mockReturnValueOnce(true);
    const target = makeMember('t', 1);
    const requester = makeMember('r', 2);
    const bot = makeMember('b', 3);
    expect(checkModPermissions(target, requester, bot)).toBe(true);
    expect(checkRole).toHaveBeenCalled();
  });

  test('handles null highest roles without crash (delegation still occurs)', () => {
    (checkRole as jest.Mock).mockReturnValueOnce(true);
    const target = { id: 't', roles: { highest: null }, guild: { ownerId: 'own' } } as any;
    const requester = { id: 'r', roles: { highest: null }, guild: { ownerId: 'own' } } as any;
    const bot = { id: 'b', roles: { highest: { position: 10 } }, guild: { ownerId: 'own' } } as any;
    const { checkModPermissions } = require('../../../src/utils/moderationHelpers');
    const res = checkModPermissions(target, requester, bot);
    expect(res).toBe(true);
    expect(checkRole).toHaveBeenCalledWith(target, requester, bot);
  });
});

describe('validateDuration', () => {
  test('rejects invalid / too small / too big', () => {
    expect(validateDuration('abc')).toBeNull();
    expect(validateDuration('1s')).toBeNull();
    expect(validateDuration('1000d')).toBeNull();
  });

  test('accepts valid range', () => {
    const v = validateDuration('10m');
    expect(v).not.toBeNull();
    expect(v! >= 600_000).toBe(true);
  });
});

describe('formatDuration', () => {
  test('formats milliseconds to human string', async () => {
  const str = await formatDuration(60_000);
  expect(typeof str).toBe('string');
  expect(/1m/i.test(str)).toBe(true);
  });
});

describe('findBannedUser', () => {
  function makeGuild(cacheUser?: User, fetchUser?: User | null, throwOnFetch = false): Guild {
    const cache = cacheUser
      ? new Map([[cacheUser.id, { user: cacheUser }]])
      : new Map<string, any>();
    return {
      id: 'g1',
      bans: {
        cache: cache as any,
        fetch: jest.fn(async (id?: string) => {
          if (throwOnFetch) throw new Error('fetch fail');
          if (id) {
            if (!fetchUser) throw new Error('not found');
            return { user: fetchUser };
          }
          return new Map();
        }),
      },
    } as any;
  }

  test('returns user from cache if present', async () => {
    const u = makeUser('u1');
    const guild = makeGuild(u, null);
    const res = await findBannedUser(guild, 'u1');
    expect(res).toBe(u);
  });

  test('fetches when not in cache and returns user', async () => {
    const fetched = makeUser('u2');
    const guild = makeGuild(undefined, fetched);
    const res = await findBannedUser(guild, 'u2');
    expect(res).toBe(fetched);
  });

  test('returns null when not found', async () => {
    const guild = makeGuild(undefined, null);
    const res = await findBannedUser(guild, 'nope');
    expect(res).toBeNull();
  });

  test('handles errors and logs', async () => {
    const guild: Guild = { id: 'g1', bans: null as any } as any;
    const res = await findBannedUser(guild, 'x');
    expect(res).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
