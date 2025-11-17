import { SlashCommandBuilder } from 'discord.js';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  const readdirSync = (dir: string) => {
    const norm = String(dir).replace(/\\/g, '/');
    if (norm.endsWith('src/commands') || norm.endsWith('src/validations')) return [];
    return real.readdirSync(dir);
  };
  const statSync = (_p: string) => ({ isDirectory: () => false });
  return { ...real, readdirSync, statSync };
});

class FakeEmitter {
  private events: Record<string, Function[]> = {};
  on(e: string, f: Function) { (this.events[e] ||= []).push(f); return this; }
  once(e: string, f: Function) { (this.events[e] ||= []).push(f); return this; }
  emit(e: string, ...args: any[]) { (this.events[e] || []).forEach(fn => fn(...args)); }
}
class FakeClient extends FakeEmitter {
  application: any = { commands: { fetch: async () => ({ find: (_fn: any) => undefined }), create: jest.fn(), edit: jest.fn(), set: jest.fn(async () => []) } };
  guilds: any = { fetch: jest.fn() };
}

const sc = (name: string, desc='d') => new SlashCommandBuilder().setName(name).setDescription(desc);

describe('CommandHandler extra branches', () => {
  let CommandHandlerClass: any; let client: FakeClient;
  beforeEach(() => { jest.resetModules(); client = new FakeClient(); CommandHandlerClass = require('../../../src/handlers/CommandHandler').CommandHandler; });

  test('registerCommands throws when client.application missing', async () => {
    const handler = new CommandHandlerClass(client, {});
    (client as any).application = null;
    await expect((handler as any).registerCommands()).rejects.toThrow(/brak client\.application/);
  });

  test('clearCommands throws when client.application missing', async () => {
    const handler = new CommandHandlerClass(client, {});
    (client as any).application = null;
    await expect((handler as any).clearCommands()).rejects.toThrow(/brak client\.application/);
  });

  test('executeCommand returns early when command not found (no reply/followUp)', async () => {
    const handler = new CommandHandlerClass(client, {});
    const inter: any = {
      commandName: 'ghost',
      isChatInputCommand: () => true,
      isContextMenuCommand: () => false,
      isAutocomplete: () => false,
      replied: false,
      deferred: false,
      reply: jest.fn(async () => {}),
      followUp: jest.fn(async () => {}),
      user: { id: 'u' },
    };
    await (handler as any).handleInteraction(inter);
    expect(inter.reply).not.toHaveBeenCalled();
    expect(inter.followUp).not.toHaveBeenCalled();
  });

  test('non-bulk: only dev commands and no devGuildIds -> skip both global and dev registrations', async () => {
    const handler = new CommandHandlerClass(client, {});
    const map = (handler as any).commands as Map<string, any>;
    map.clear();
    map.set('devonly', { data: sc('devonly'), options: { devOnly: true }, run: async () => {} });
    const appFetchSpy = jest.spyOn((client as any).application.commands, 'fetch');
    await (handler as any).registerCommands();
    expect(appFetchSpy).not.toHaveBeenCalled();
    expect(client.guilds.fetch).not.toHaveBeenCalled();
  });

  test('summarize covers options with choices and empty options path', () => {
    const handler = new CommandHandlerClass(client, {});
    const summarize = (handler as any).summarize.bind(handler) as (x: any) => string;
    const noOpts = { name: 'x', description: '', type: 1 };
    const s1 = summarize(noOpts);
    expect(typeof s1).toBe('string');
    const withOpts = {
      name: 'y',
      description: undefined,
      type: 1,
      options: [
        { name: 'opt', type: 3, required: true, choices: [{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }] },
      ],
    };
    const s2 = summarize(withOpts);
    expect(s2).toContain('"options"');
    expect(s2).toContain('"choices"');
  });
});
