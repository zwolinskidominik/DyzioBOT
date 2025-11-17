import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import { Collection, type Guild, type GuildMember } from 'discord.js';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { ChannelStatsModel } from '../../../src/models/ChannelStats';
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
const logger = require('../../../src/utils/logger').default;
import { updateChannelStats } from '../../../src/utils/channelHelpers';

describe('utils/channelHelpers: updateChannelStats (E2E)', () => {
  let db: DbManager;

  beforeAll(async () => {
    jest.setTimeout(20000);
    db = new DbManager();
    await db.startDb();
  });

  afterAll(async () => {
    await db.stopDb();
  });

  beforeEach(async () => {
    await clearTestData();
    jest.clearAllMocks();
  });

  function makeMember(id: string, username: string, joined: number, bot = false): GuildMember {
    return { id, user: { id, username, bot }, joinedTimestamp: joined } as unknown as GuildMember;
  }

  function textChannel(id: string, name: string) {
    return {
      id,
      name,
      setName: jest.fn(async function (this: any, newName: string) {
        (this as any).name = newName;
        return this;
      }),
    };
  }

  function makeGuild(members: GuildMember[], memberCount?: number) {
    const membersCache = new Collection<string, GuildMember>();
    members.forEach((m) => membersCache.set(m.id, m));

    const channelMap = new Collection<string, any>();
    const chans = {
      usersChan: textChannel('usersChan', 'Users: 0'),
      botsChan: textChannel('botsChan', 'Bots: 0'),
      bansChan: textChannel('bansChan', 'Bans: 0'),
      lastChan: textChannel('lastChan', 'Ostatni: Brak'),
    };
    Object.values(chans).forEach((c: any) => channelMap.set(c.id, c));

    const bansFetch = jest.fn(async () => new Collection<string, any>([]));
    const membersFetch = jest.fn(async () => membersCache);

    const guild: Guild = {
      id: 'g1',
      members: { cache: membersCache, fetch: membersFetch } as any,
      memberCount: memberCount ?? members.length,
      channels: { cache: channelMap } as any,
      bans: { fetch: bansFetch } as any,
    } as unknown as Guild;

    return { guild, channels: chans, bansFetch, membersFetch };
  }

  it('first call: fetch members/bans and save to DB; second within TTL: no extra fetch', async () => {
    const members = [
      makeMember('1', 'Alice', 1000),
      makeMember('2', 'Bob', 2000),
      makeMember('3', 'Botty', 1500, true),
    ];
    const { guild, channels, bansFetch, membersFetch } = makeGuild(members, members.length + 2);

    await ChannelStatsModel.create({
      guildId: 'g1',
      channels: {
        users: { channelId: 'usersChan', template: 'Users: <>' },
        bots: { channelId: 'botsChan', template: 'Bots: <>' },
        bans: { channelId: 'bansChan', template: 'Bans: <>' },
        lastJoined: { channelId: 'lastChan', template: 'Ostatni: <>' },
      },
    });
    await updateChannelStats(guild);
    expect(membersFetch).toHaveBeenCalled();
    expect(bansFetch).toHaveBeenCalled();

    const doc1 = await ChannelStatsModel.findOne({ guildId: 'g1' }).lean().exec();
    expect(doc1?.channels.lastJoined?.member).toBe('2');
    expect(channels.usersChan.name).toMatch(/Users:/);
    expect(channels.botsChan.name).toMatch(/Bots:/);
    expect(channels.bansChan.name).toMatch(/Bans:/);

    const bansCalls = bansFetch.mock.calls.length;
    const membersCalls = membersFetch.mock.calls.length;
    await updateChannelStats(guild);
    expect(bansFetch.mock.calls.length).toBe(bansCalls);
    expect(membersFetch.mock.calls.length).toBe(membersCalls);
  }, 20000);

  it('edge: bans fetch 50013 -> logs and continues; save throws -> logs error without crashing', async () => {
    const { guild, channels, bansFetch } = makeGuild([makeMember('1', 'User', 1000)], 2);
    await ChannelStatsModel.create({
      guildId: 'g1',
      channels: {
        users: { channelId: 'usersChan', template: 'Users: <>' },
        bots: { channelId: 'botsChan', template: 'Bots: <>' },
        bans: { channelId: 'bansChan', template: 'Bans: <>' },
        lastJoined: { channelId: 'lastChan', template: 'Ostatni: <>' },
      },
    });
    bansFetch.mockRejectedValueOnce({ code: 50013 });
    await updateChannelStats(guild);

    expect(channels.usersChan.name).toMatch(/Users:/);

    const spy = jest.spyOn(ChannelStatsModel, 'findOne').mockResolvedValueOnce({
      guildId: 'g1',
      channels: {
        users: { channelId: 'usersChan', template: 'Users: <>' },
        bots: { channelId: 'botsChan', template: 'Bots: <>' },
        bans: { channelId: 'bansChan', template: 'Bans: <>' },
        lastJoined: { channelId: 'lastChan', template: 'Ostatni: <>' },
      },
      save: jest.fn(() => { throw new Error('save fail'); }),
    } as any);

    await updateChannelStats(guild);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd przy aktualizacji statystyk'));

    spy.mockRestore();
  }, 20000);
});
