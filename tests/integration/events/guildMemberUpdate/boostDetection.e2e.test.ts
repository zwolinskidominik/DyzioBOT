import { EventEmitter } from 'events';
import { createEventHarness, resetEventHarness } from '../../discord/eventHarness';

// We will dynamically mock configs and fs within isolated module imports per test

// Helpers to build guild/member and channels
function makeGuild() {
  const channels = new Map<string, any>();
  const membersData = new Map<string, any>();
  const membersCache: any = {
    set: (k: string, v: any) => membersData.set(k, v),
    get: (k: string) => membersData.get(k),
    // Provide filter -> map -> join chain as used by handler
    filter: (fn: (m: any) => boolean) => {
      const arr = Array.from(membersData.values()).filter(fn);
      return {
        map: (mapFn: (m: any) => any) => ({
          join: (sep: string) => arr.map(mapFn).join(sep),
        }),
      } as any;
    },
  };
  const guild: any = {
    id: 'g1',
    client: { user: { id: 'bot-1' } },
    channels: { cache: { get: (id: string) => channels.get(id) } },
    members: { cache: membersCache },
  };
  return { guild, channels, membersCache } as const;
}

function makeTextChannel(sendImpl?: any, messagesFetchImpl?: any) {
  const send = sendImpl || jest.fn(async () => ({}));
  const messages = { fetch: messagesFetchImpl || jest.fn(async () => new Map()) };
  return { id: 'text', type: 0, send, messages } as any;
}

function makeMember(guild: any, userId: string, boosting: boolean) {
  const m: any = {
    guild,
    client: guild.client,
    user: { id: userId },
    premiumSince: boosting ? new Date() : null,
  };
  if (boosting) (guild.members.cache as any).set(userId, m);
  return m;
}

describe('guildMemberUpdate: boostDetection (E2E)', () => {
  let client: any;
  let harness: ReturnType<typeof createEventHarness>;
  // We'll capture the per-isolate mocked logger to assert against it
  let mockedLogger: { error: jest.Mock; warn: jest.Mock; info: jest.Mock } | null = null;

  beforeEach(() => {
    resetEventHarness();
    harness = createEventHarness();
  // Use a lightweight EventEmitter as a fake Discord client to avoid loading discord.js internals
  client = new EventEmitter();
    harness.setClient(client);
    mockedLogger = null;
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('missing booster list channel -> logs error', async () => {
    const { guild, channels } = makeGuild();
    // Provide boost notification channel so initial thanks can be sent
    const boostChan = makeTextChannel();
    channels.set('boostChan', boostChan);

    // Mock configs for this test
    await jest.isolateModulesAsync(async () => {
      // Mock logger in this isolated module graph
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'missing' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      // fs access will be attempted but list channel missing prevents update flow
      const { default: run } = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      client.on('guildMemberUpdate', (o: any, n: any) => run(o as any, n as any));

      const oldMember = makeMember(guild, 'u1', false);
      const newMember = makeMember(guild, 'u1', true);
      // Provide members cache chain
      (guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({ join: (sep: string) => '' }),
        }),
      } as any;

      await harness.emitGuildMemberUpdate(oldMember as any, newMember as any);
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(mockedLogger!.error).toHaveBeenCalledWith('Nie znaleziono kanału do aktualizacji listy boosterów!');
  });

  it('fs.access reject -> sends text-only list', async () => {
    const { guild, channels } = makeGuild();
    const textSends: any = [];
    const listChannel = makeTextChannel(jest.fn(async (payload: any) => { textSends.push(payload); }), undefined);
    const boostChan = makeTextChannel();
    channels.set('booster-list', listChannel);
    channels.set('boostChan', boostChan);

    await jest.isolateModulesAsync(async () => {
      // Mock logger and capture
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'booster-list' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      const mod = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      (mod as any).__setFsAccess?.(jest.fn(async () => { throw new Error('missing'); }));
      client.on('guildMemberUpdate', (o: any, n: any) => (mod as any).default(o as any, n as any));

      const oldMember = makeMember(guild, 'u1', false);
      const newMember = makeMember(guild, 'u1', true);
      // Provide members cache that returns a single mention string
      (guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({ join: (sep: string) => ':sparkles: <@!u1>' }),
        }),
      } as any;

      await harness.emitGuildMemberUpdate(oldMember as any, newMember as any);
      await new Promise((r) => setTimeout(r, 60));
    });

    // One of the sends should be content-only booster list
    expect(textSends.some((p: any) => 'content' in p && typeof p.content === 'string')).toBe(true);
    // Error path logged
    expect(mockedLogger!.error).toHaveBeenCalled();
  });

  it('fs.access resolve -> deletes old bot messages, sends banner and list', async () => {
    const { guild, channels } = makeGuild();

    // Prepare message collection with two bot messages (attachment and list content)
    const botId = guild.client.user.id;
    const oldMsgWithAttachment = { author: { id: botId }, attachments: { size: 1 }, content: '', delete: jest.fn(async () => {}) };
    const oldMsgWithList = { author: { id: botId }, attachments: { size: 0 }, content: ':sparkles: <@!someone>', delete: jest.fn(async () => {}) };
    const collectionValues = [oldMsgWithAttachment, oldMsgWithList];
    const messagesFetch = jest.fn(async () => ({
      filter: (fn: (m: any) => boolean) => {
        const filtered = collectionValues.filter(fn);
        const mapLike = new Map<string, any>();
        filtered.forEach((m, idx) => mapLike.set(String(idx), m));
        // Important: handler uses .values() iterator
        (mapLike as any).values = () => filtered.values();
        return mapLike as any;
      },
    }));

    const send = jest.fn(async () => {});
    const listChannel = makeTextChannel(send, messagesFetch);
    const boostChan = makeTextChannel();
    channels.set('booster-list', listChannel);
    channels.set('boostChan', boostChan);

    await jest.isolateModulesAsync(async () => {
      // Mock logger and capture
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan', boosterList: 'booster-list' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:', list: ':sparkles:' } } }),
      }));
      const mod = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      (mod as any).__setFsAccess?.(jest.fn(async () => {}));
      client.on('guildMemberUpdate', (o: any, n: any) => (mod as any).default(o as any, n as any));

      const oldMember = makeMember(guild, 'u1', false);
      const newMember = makeMember(guild, 'u1', true);
      (guild.members as any).cache = {
        filter: (fn: (m: any) => boolean) => ({
          map: (mapFn: (m: any) => any) => ({ join: (sep: string) => ':sparkles: <@!u1>' }),
        }),
      } as any;

      await harness.emitGuildMemberUpdate(oldMember as any, newMember as any);
      await new Promise((r) => setTimeout(r, 60));
    });

    // Deletions attempted
    expect((oldMsgWithAttachment.delete as jest.Mock)).toHaveBeenCalled();
    expect((oldMsgWithList.delete as jest.Mock)).toHaveBeenCalled();
    // Two sends: one banner with files and one with content
    expect(send).toHaveBeenCalledWith({ files: [{ attachment: expect.any(String), name: 'boosterBanner.png' }] });
    expect(send).toHaveBeenCalledWith({ content: expect.stringContaining(':sparkles: <@!u1>') });
  });
});
