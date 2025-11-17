import { EventEmitter } from 'events';
import { createEventHarness, resetEventHarness } from '../../discord/eventHarness';

function makeGuild() {
  const createdChannels: any[] = [];
  const guild: any = {
    id: 'g1',
    client: { user: { id: 'bot-1' } },
    channels: {
      create: jest.fn(async (opts: any) => {
        const ch = { id: `ticket-${createdChannels.length + 1}`, ...opts, send: jest.fn(), delete: jest.fn() };
        createdChannels.push(ch);
        return ch;
      }),
      cache: new Map()
    },
    members: {
      me: { permissions: { has: jest.fn(() => true) } }
    },
    roles: { cache: new Map() },
    iconURL: () => 'http://icon-url'
  };
  return { guild, createdChannels };
}

function makeButtonInteraction(guild: any, customId: string, channel: any = null, userId = 'u1') {
  const mockChannel = channel || { 
    id: 'c-open', 
    name: 'pomoc-user1',
    send: jest.fn(async () => {}),
    permissionsFor: jest.fn(() => ({ has: jest.fn(() => true) }))
  };
  const message = {
    components: [
      { components: [ { type: 2, customId: 'zajmij-zgloszenie', label: 'Zajmij zgłoszenie', style: 1 } ] }
    ],
    edit: jest.fn().mockResolvedValue(undefined)
  };
  return {
    isChatInputCommand: () => false,
    isStringSelectMenu: () => false,
    isButton: () => true,
    customId,
    guild,
    channel: mockChannel,
    user: { id: userId, username: 'user1' },
    member: {
      user: { username: 'user1' },
      roles: {
        cache: {
          some: (fn: Function) => ['ownerR','adminR','modR','partnerR'].some(id => fn({ id })),
          get: (id: string) => ({ id })
        }
      }
    },
    message,
    deferUpdate: jest.fn(async () => {}),
    followUp: jest.fn(async () => {}),
    deleteReply: jest.fn(async () => {}),
  } as any;
}

function makeSelectMenuInteraction(guild: any, value: string = 'help') {
  return {
    isChatInputCommand: () => false,
    isStringSelectMenu: () => true,
    isButton: () => false,
    customId: 'ticket-menu',
    values: [value],
    guild,
    user: { id: 'u1', username: 'User1', tag: 'User1#0001', displayAvatarURL: () => 'url' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeSetupCommandInteraction(guild: any) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    commandName: 'ticket-setup',
    guild,
    user: { id: 'admin-1' },
    member: { id: 'admin-1' },
    channel: { id: 'c1', send: jest.fn(async () => {}) },
    reply: jest.fn(async () => {}),
    deferReply: jest.fn(async () => {}),
    editReply: jest.fn(async () => {}),
  } as any;
}

describe('interactionCreate: ticketSystem (E2E)', () => {
  let client: any;
  let harness: ReturnType<typeof createEventHarness>;
  let mockedLogger: { error: jest.Mock; warn: jest.Mock; info: jest.Mock } | null = null;

  beforeEach(() => {
    resetEventHarness();
    harness = createEventHarness();
    client = new EventEmitter();
    harness.setClient(client);
    mockedLogger = null;
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('setup + select menu -> creates channel', async () => {
    const { guild, createdChannels } = makeGuild();
    (guild.channels.cache as Map<string, any>).set('tickets-category', { id: 'tickets-category', type: 4, children: { create: guild.channels.create } });

    await jest.isolateModulesAsync(async () => {
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;

      const TicketStateModel = { create: jest.fn(async () => ({})), updateOne: jest.fn(async () => ({})), findOne: jest.fn(async () => null), findOneAndUpdate: jest.fn(async () => ({})) };
      const TicketStatsModel = { updateOne: jest.fn(async () => ({})), findOneAndUpdate: jest.fn(async () => ({})) };
      jest.doMock('../../../../src/models/TicketState', () => ({ __esModule: true, TicketStateModel }));
      jest.doMock('../../../../src/models/TicketStats', () => ({ __esModule: true, TicketStatsModel }));
      jest.doMock('../../../../src/models/TicketConfig', () => ({
        __esModule: true,
        TicketConfigModel: { findOne: jest.fn(async () => ({ guildId: 'g1', categoryId: 'tickets-category' })) }
      }));
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { ticketsCategory: 'tickets-category' }, roles: { owner: 'ownerR', admin: 'adminR', mod: 'modR', partnership: 'partnerR' } }),
      }));

      const mod = await import('../../../../src/events/interactionCreate/ticketSystem');
      const handler: any =
        (mod as any).default ??
        (mod as any).run ??
        (mod as any).execute ??
        (mod as any).handler ??
        (typeof mod === 'function' ? (mod as any) : undefined);
      client.on('interactionCreate', (i: any) => handler?.(i as any));

      const setup = makeSetupCommandInteraction(guild);
      client.emit('interactionCreate', setup);
      await new Promise((r) => setTimeout(r, 30));
      const select = makeSelectMenuInteraction(guild, 'help');
      client.emit('interactionCreate', select);
      await new Promise((r) => setTimeout(r, 200));

      expect(guild.channels.create).toHaveBeenCalled();
      expect(createdChannels.length).toBeGreaterThan(0);
      expect(select.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Stworzono zgłoszenie') }));
    });
  });

  it('take ticket button -> updates TicketState and TicketStats', async () => {
    const { guild } = makeGuild();

    await jest.isolateModulesAsync(async () => {
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;

      const TicketStateModel = { findOne: jest.fn(async () => null), findOneAndUpdate: jest.fn(async () => ({})) };
      const TicketStatsModel = { findOneAndUpdate: jest.fn(async () => ({})) };
      jest.doMock('../../../../src/models/TicketState', () => ({ __esModule: true, TicketStateModel }));
      jest.doMock('../../../../src/models/TicketStats', () => ({ __esModule: true, TicketStatsModel }));
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ roles: { owner: 'ownerR', admin: 'adminR', mod: 'modR', partnership: 'partnerR' } }),
      }));

      const mod = await import('../../../../src/events/interactionCreate/ticketSystem');
      const handler: any =
        (mod as any).default ??
        (mod as any).run ??
        (mod as any).execute ??
        (mod as any).handler ??
        (typeof mod === 'function' ? (mod as any) : undefined);
      client.on('interactionCreate', (i: any) => handler?.(i as any));

      const btn = makeButtonInteraction(guild, 'zajmij-zgloszenie', { id: 'chan1', name: 'pomoc-user1', send: jest.fn(), permissionsFor: jest.fn(() => ({ has: jest.fn(() => true) })) }, 'u1');
      client.emit('interactionCreate', btn);
      await new Promise((r) => setTimeout(r, 200));

      expect(TicketStateModel.findOneAndUpdate).toHaveBeenCalled();
      expect(TicketStatsModel.findOneAndUpdate).toHaveBeenCalled();
      expect(btn.message.edit).toHaveBeenCalled();
    });
  });

  it('missing permissions when creating channel -> logs error and replies with failure', async () => {
    const { guild } = makeGuild();
    (guild.channels.cache as Map<string, any>).set('tickets-category', { id: 'tickets-category', type: 4, children: { create: guild.channels.create } });
    (guild.channels.create as jest.Mock).mockImplementationOnce(async () => { throw new Error('Missing Permissions'); });

    await jest.isolateModulesAsync(async () => {
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;

      jest.doMock('../../../../src/models/TicketState', () => ({ __esModule: true, TicketStateModel: { findOne: jest.fn(async () => null) } }));
      jest.doMock('../../../../src/models/TicketStats', () => ({ __esModule: true, TicketStatsModel: {} }));
      jest.doMock('../../../../src/models/TicketConfig', () => ({
        __esModule: true,
        TicketConfigModel: { findOne: jest.fn(async () => ({ guildId: 'g1', categoryId: 'tickets-category' })) }
      }));
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ roles: { owner: 'ownerR', admin: 'adminR', mod: 'modR', partnership: 'partnerR' } }),
      }));

      const mod = await import('../../../../src/events/interactionCreate/ticketSystem');
      const handler: any =
        (mod as any).default ??
        (mod as any).run ??
        (mod as any).execute ??
        (mod as any).handler ??
        (typeof mod === 'function' ? (mod as any) : undefined);
      client.on('interactionCreate', (i: any) => handler?.(i as any));

      const select = makeSelectMenuInteraction(guild, 'help');
      client.emit('interactionCreate', select);
      await new Promise((r) => setTimeout(r, 200));

      expect(localLogger.error).toHaveBeenCalled();
      const editArg = (select.editReply as jest.Mock).mock.calls.find(c => (c[0]?.content || '').includes('Wystąpił błąd'));
      expect(editArg).toBeTruthy();
    });
  });

  it('logs when ticket category is missing', async () => {
    const { guild } = makeGuild();

    await jest.isolateModulesAsync(async () => {
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;

      jest.doMock('../../../../src/models/TicketState', () => ({ __esModule: true, TicketStateModel: {} }));
      jest.doMock('../../../../src/models/TicketStats', () => ({ __esModule: true, TicketStatsModel: {} }));
      jest.doMock('../../../../src/models/TicketConfig', () => ({
        __esModule: true,
        TicketConfigModel: { findOne: jest.fn(async () => ({ guildId: 'g1', categoryId: 'missing-category' })) }
      }));

      const mod = await import('../../../../src/events/interactionCreate/ticketSystem');
      const handler: any =
        (mod as any).default ??
        (mod as any).run ??
        (mod as any).execute ??
        (mod as any).handler ??
        (typeof mod === 'function' ? (mod as any) : undefined);
      client.on('interactionCreate', (i: any) => handler?.(i as any));

      const select = makeSelectMenuInteraction(guild, 'help');
      client.emit('interactionCreate', select);
      await new Promise((r) => setTimeout(r, 150));

      const editArg = (select.editReply as jest.Mock).mock.calls.find(c => (c[0]?.content || '').includes('Nie znaleziono kategorii'));
      expect(editArg).toBeTruthy();
    });
  });

  it('unknown customId -> no-op', async () => {
    const { guild } = makeGuild();

    await jest.isolateModulesAsync(async () => {
      const localLogger: any = { error: jest.fn(() => localLogger), warn: jest.fn(() => localLogger), info: jest.fn(() => localLogger) };
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: localLogger }));
      mockedLogger = localLogger;

      const TicketStateModel = { updateOne: jest.fn(), findOneAndUpdate: jest.fn() };
      const TicketStatsModel = { updateOne: jest.fn() };
      jest.doMock('../../../../src/models/TicketState', () => ({ __esModule: true, TicketStateModel }));
      jest.doMock('../../../../src/models/TicketStats', () => ({ __esModule: true, TicketStatsModel }));

      const mod = await import('../../../../src/events/interactionCreate/ticketSystem');
      const handler: any =
        (mod as any).default ??
        (mod as any).run ??
        (mod as any).execute ??
        (mod as any).handler ??
        (typeof mod === 'function' ? (mod as any) : undefined);
      client.on('interactionCreate', (i: any) => handler?.(i as any));

      const unknownBtn = makeButtonInteraction(guild, 'unknown-custom-id', { id: 'x', name: 'pomoc-user1', send: jest.fn(), permissionsFor: jest.fn(() => ({ has: jest.fn(() => true) })) }, 'u3');
      client.emit('interactionCreate', unknownBtn);
      await new Promise((r) => setTimeout(r, 100));

      expect(TicketStateModel.updateOne).not.toHaveBeenCalled();
      expect(TicketStateModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(TicketStatsModel.updateOne).not.toHaveBeenCalled();
    });
  });
});
