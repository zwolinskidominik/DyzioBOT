import { pickWinners } from '../../../src/utils/giveawayHelpers';
import type { Guild, User, GuildMember } from 'discord.js';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
const logger = require('../../../src/utils/logger').default;

function makeUser(id: string): User {
  return { id, username: `user_${id}` } as unknown as User;
}
function makeMember(id: string): GuildMember {
  return { user: makeUser(id) } as unknown as GuildMember;
}

function makeGuild(initialIds: string[] = []) {
  const cache = new Map<string, GuildMember>();
  initialIds.forEach((id) => cache.set(id, makeMember(id)));

  const membersFetch = jest.fn(async (arg: any) => {
    if (arg && typeof arg === 'object' && Array.isArray(arg.user)) {
      for (const id of arg.user) {
        if (!cache.has(id)) cache.set(id, makeMember(id));
      }
      return;
    }
    if (typeof arg === 'string') {
      if (!cache.has(arg)) cache.set(arg, makeMember(arg));
      return cache.get(arg)!;
    }
  });

  const usersFetch = jest.fn(async (id: string) => makeUser(id));

  const guild: Guild = {
    members: { cache, fetch: membersFetch } as any,
    client: { users: { fetch: usersFetch } } as any,
  } as unknown as Guild;

  return { guild, membersFetch, usersFetch, cache };
}

beforeAll(() => {
  jest.spyOn(Math, 'random').mockReturnValue(0.01);
});

afterAll(() => {
  (Math.random as any).mockRestore?.();
});

describe('pickWinners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty array for no participants', async () => {
    const { guild } = makeGuild();
    const res = await pickWinners([], 2, guild);
    expect(res).toEqual([]);
  });

  test('deterministic winner with mocked Math.random', async () => {
    const { guild } = makeGuild(['a', 'b', 'c']);
    // With Math.random mocked to 0.01 (see beforeAll), shuffle keeps order for first picks
    const res = await pickWinners(['a', 'b', 'c'], 1, guild);
    expect(res.map((u) => u.id)).toEqual(['a']);
  });

  test('coerces invalid winnersCount (<1) to 1 and warns', async () => {
    const { guild } = makeGuild(['1', '2']);
    const res = await pickWinners(['1', '2'], 0, guild);
    expect(res.length).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('respects winnersCount and no duplicates in result', async () => {
    const ids = ['1', '1', '2', '3', '2'];
    const { guild } = makeGuild(['1', '2', '3']);
    const res = await pickWinners(ids, 2, guild);
    expect(res.length).toBe(2);
    const unique = new Set(res.map((u) => u.id));
    expect(unique.size).toBe(2);
  });

  test('requests more winners than unique participants yields all unique without error', async () => {
    const ids = ['1', '1', '2'];
    const { guild } = makeGuild(['1', '2']);
    const res = await pickWinners(ids, 5, guild);
    const unique = [...new Set(res.map((u) => u.id))];
    expect(unique.sort()).toEqual(['1', '2']);
  });

  test('bulk fetch fills missing members before selection completes', async () => {
    const participants = ['10', '11', '12'];
    const { guild, membersFetch, cache } = makeGuild([]);
    const res = await pickWinners(participants, 2, guild);
    expect(membersFetch).toHaveBeenCalledWith({ user: expect.arrayContaining(participants) });
    expect(cache.size).toBeGreaterThanOrEqual(2);
    expect(res.length).toBe(2);
  });

  test('falls back to single member fetch when still missing after bulk', async () => {
    const cache = new Map<string, GuildMember>();
    const membersFetch = jest.fn(async (arg: any) => {
      if (arg && typeof arg === 'object' && Array.isArray(arg.user)) {
        throw new Error('bulk fail');
      }
      if (typeof arg === 'string') {
        if (!cache.has(arg)) cache.set(arg, makeMember(arg));
        return cache.get(arg)!;
      }
    });
    const usersFetch = jest.fn(async (id: string) => makeUser(id));
    const guild: Guild = {
      members: { cache, fetch: membersFetch } as any,
      client: { users: { fetch: usersFetch } } as any,
    } as any;

    const res = await pickWinners(['42'], 1, guild);
    expect(membersFetch).toHaveBeenCalled();
    expect(usersFetch).not.toHaveBeenCalled();
    expect(res[0].id).toBe('42');
  });

  test('final fallback uses client.users.fetch when member fetch fails entirely', async () => {
    const membersFetch = jest.fn(async () => {
      throw new Error('all member fetch fail');
    });
    const usersFetch = jest.fn(async (id: string) => makeUser(id));
    const guild: Guild = {
      members: { cache: new Map(), fetch: membersFetch } as any,
      client: { users: { fetch: usersFetch } } as any,
    } as any;

    const res = await pickWinners(['99'], 1, guild);
    expect(usersFetch).toHaveBeenCalledWith('99');
    expect(res[0].id).toBe('99');
  });

  test('returns at most requested number of winners even if more participants', async () => {
    const { guild } = makeGuild(['1', '2', '3', '4', '5']);
    const res = await pickWinners(['1', '2', '3', '4', '5'], 3, guild);
    expect(res.length).toBe(3);
  });

  test('logs warn when no winners resolved after all fallbacks', async () => {
    const membersFetch = jest.fn(async (arg: any) => {
      if (arg && typeof arg === 'object' && Array.isArray(arg.user)) {
        throw new Error('bulk fail');
      }
      if (typeof arg === 'string') {
        throw new Error('single fail');
      }
    });
    const usersFetch = jest.fn(async () => {
      throw new Error('user fetch fail');
    });
    const guild: Guild = {
      members: { cache: new Map(), fetch: membersFetch } as any,
      client: { users: { fetch: usersFetch } } as any,
    } as any;

    const res = await pickWinners(['10', '11'], 2, guild);
    expect(res).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('brak zwycięzców')
    );
  });
});
