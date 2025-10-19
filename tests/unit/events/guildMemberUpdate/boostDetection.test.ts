export {};

// Mock logger
const logger = { error: jest.fn().mockReturnThis(), warn: jest.fn().mockReturnThis() };
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: logger }));

// Mock fs.promises
jest.mock('fs', () => ({ promises: { access: jest.fn() } }));

function makeMember(boosting = false) {
  const channelsCache = new Map<string, any>();
  const membersData = new Map<string, any>();
  const membersCache: any = {
    set: (k: string, v: any) => membersData.set(k, v),
    get: (k: string) => membersData.get(k),
    filter: (fn: (m: any) => boolean) => {
      const arr: any[] = Array.from(membersData.values()).filter(fn);
      // Make returned value behave like a Collection for map/join
      arr.map = Array.prototype.map.bind(arr);
      arr.join = Array.prototype.join.bind(arr);
      return arr as any;
    },
  };
  const guild: any = {
    id: 'g1',
    client: { user: { id: 'bot' } },
    channels: { cache: channelsCache },
    members: { cache: membersCache },
  };
  const m: any = { guild, client: guild.client, user: { id: 'u1' }, premiumSince: boosting ? new Date() : null };
  if (boosting) membersCache.set('u1', m);
  return { guild, member: m };
}

describe('guildMemberUpdate/boostDetection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('logs when booster list channel missing', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'missing' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      const { default: run } = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      const oldMember = makeMember(false).member;
      const { member: newMember } = makeMember(true);
      // Provide Collection-like chain for members cache
      const filtered = [] as any[];
      (newMember.guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({
            join: (sep: string) => '',
          }),
        }),
      } as any;
      await run(oldMember as any, newMember as any);
    });
    expect(logger.error).toHaveBeenCalledWith('Nie znaleziono kanału do aktualizacji listy boosterów!');
  });

  test('fs.access fails -> sends boosters list (no banner) and logs error', async () => {
  const { guild, member: newMember } = makeMember(true);
    const textChannel = { messages: { fetch: jest.fn().mockResolvedValue(new Map()) }, send: jest.fn() } as any;
    guild.channels.cache.set('booster-list', textChannel);
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'booster-list' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      (require('fs').promises.access as jest.Mock).mockRejectedValueOnce(new Error('missing'));
      const { default: run } = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      const oldMember = makeMember(false).member;
      // Provide Collection-like chain for members cache
      (newMember.guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({
            join: (sep: string) => '',
          }),
        }),
      } as any;
      await run(oldMember as any, newMember as any);
    });
    expect(logger.error).toHaveBeenCalled();
    expect(textChannel.send).toHaveBeenCalledWith({ content: expect.any(String) });
  });

  test('fs.access resolves -> deletes old bot messages, sends banner and list', async () => {
    const { guild, member: newMember } = makeMember(true);
    // Prepare collection-like messages fetch result
    const oldMsgWithAttachment = {
      author: { id: guild.client.user.id },
      attachments: { size: 1 },
      content: '',
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const oldMsgWithList = {
      author: { id: guild.client.user.id },
      attachments: { size: 0 },
      content: ':sparkles: <@!someone>',
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const col = new Map<string, any>();
    col.set('1', oldMsgWithAttachment);
    col.set('2', oldMsgWithList);
    const messagesFetch = jest.fn().mockResolvedValue({
      filter: (fn: (m: any) => boolean) => {
        const filtered = Array.from(col.values()).filter(fn);
        const mapLike = new Map<string, any>();
        filtered.forEach((m, idx) => mapLike.set(String(idx), m));
        mapLike.values = () => filtered.values();
        return mapLike;
      },
    });
    const send = jest.fn();
    const textChannel: any = { messages: { fetch: messagesFetch }, send };
    guild.channels.cache.set('booster-list', textChannel);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'booster-list' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      (require('fs').promises.access as jest.Mock).mockResolvedValueOnce(undefined);
      const { default: run } = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      const oldMember = makeMember(false).member;
      // Provide Collection-like members cache that returns one booster mention
      (newMember.guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({
            join: (sep: string) => ':sparkles: <@!u1>',
          }),
        }),
      } as any;
      await run(oldMember as any, newMember as any);
    });

    // Old messages deleted
    expect((oldMsgWithAttachment.delete as jest.Mock)).toHaveBeenCalled();
    expect((oldMsgWithList.delete as jest.Mock)).toHaveBeenCalled();
    // Two sends: banner (files) and list (content)
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ files: [{ attachment: expect.any(String), name: 'boosterBanner.png' }] });
    expect(send).toHaveBeenCalledWith({ content: expect.stringContaining(':sparkles: <@!u1>') });
  });
});
