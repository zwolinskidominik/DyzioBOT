import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import * as path from 'path';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
let logger: { error: jest.Mock; warn: jest.Mock; info: jest.Mock; debug: jest.Mock };

jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  const readdirSync = (dir: string) => {
    if (dir.replace(/\\/g,'/').endsWith('src/commands')) {
  return ['a.ts','dup.ts','dup2.ts','dev.ts','perm.ts','auto.ts','bad.ts','deleted.ts','botp.ts'];
    }
    if (dir.replace(/\\/g,'/').endsWith('src/validations')) {
  return ['cool.ts','block.ts'];
    }
    return real.readdirSync(dir);
  };
  const statSync = (_p: string) => ({ isDirectory: () => false });
  return { ...real, readdirSync, statSync };
});

const commandImpls: Record<string, any> = {};
function defineCommand(name: string, impl: any) { commandImpls[name] = impl; }

jest.mock('../../../src/commands/a.ts', () => commandImpls['a'], { virtual: true });
jest.mock('../../../src/commands/dup.ts', () => commandImpls['dup'], { virtual: true });
jest.mock('../../../src/commands/dup2.ts', () => commandImpls['dup2'], { virtual: true });
jest.mock('../../../src/commands/dev.ts', () => commandImpls['dev'], { virtual: true });
jest.mock('../../../src/commands/perm.ts', () => commandImpls['perm'], { virtual: true });
jest.mock('../../../src/commands/auto.ts', () => commandImpls['auto'], { virtual: true });
jest.mock('../../../src/commands/botp.ts', () => commandImpls['botp'], { virtual: true });
jest.mock('../../../src/commands/deleted.ts', () => commandImpls['deleted'], { virtual: true });
jest.mock('../../../src/commands/bad.ts', () => ({}), { virtual: true });
jest.mock('../../../src/validations/cool.ts', () => ({ __esModule: true, default: jest.fn(async () => null) }), { virtual: true });
jest.mock('../../../src/validations/block.ts', () => ({ __esModule: true, default: jest.fn(async () => null) }), { virtual: true });
let mockValidation: jest.Mock;
let blockValidation: jest.Mock;

const origConsoleWarn = console.warn;
let consoleWarns: any[] = [];
beforeEach(() => { consoleWarns = []; jest.resetModules(); logger = require('../../../src/utils/logger').default; mockValidation = require('../../../src/validations/cool.ts').default; blockValidation = require('../../../src/validations/block.ts').default; logger.error.mockReset(); logger.warn.mockReset(); logger.info.mockReset(); logger.debug.mockReset(); runSpy.mockReset(); autoSpy.mockReset(); console.warn=(...a:any[])=>{consoleWarns.push(a);}; });
afterAll(()=>{ console.warn=origConsoleWarn; });

class FakeEmitter { private events: Record<string, Function[]> = {}; on(e:string,f:Function){(this.events[e] ||= []).push(f);return this;} once(e:string,f:Function){(this.events[e] ||= []).push(f);return this;} emit(e:string,...args:any[]){ (this.events[e]||[]).forEach(fn=>fn(...args)); } }
class FakeClient extends FakeEmitter { application: any = { commands: { fetch: async () => new Map(), create: jest.fn(), edit: jest.fn(), set: jest.fn(()=>[]) } }; guilds: any = { fetch: jest.fn() }; }

const sc = (name: string, desc='d') => new SlashCommandBuilder().setName(name).setDescription(desc);
const runSpy = jest.fn(async () => {});
const runErrorSpy = jest.fn(async () => { throw new Error('boom'); });
const autoSpy = jest.fn(async () => {});

defineCommand('a', { data: sc('aaa'), run: runSpy });
defineCommand('dup', { data: sc('same'), run: jest.fn(async () => { throw new Error('should be overridden'); }) });
defineCommand('dup2', { data: sc('same').setDescription('second'), run: jest.fn(async () => { runSpy(); }) });
defineCommand('dev', { data: sc('devcmd'), options: { devOnly: true }, run: runSpy });
defineCommand('perm', { data: sc('needperm'), options: { userPermissions: PermissionFlagsBits.Administrator }, run: runSpy });
defineCommand('auto', { data: sc('auto'), run: runSpy, autocomplete: autoSpy });
defineCommand('botp', { data: sc('botp'), options: { botPermissions: PermissionFlagsBits.ManageChannels }, run: runSpy });
defineCommand('deleted', { data: sc('deleted'), options: { deleted: true }, run: runSpy });

describe('CommandHandler', () => {
  let CommandHandlerClass: any; let client: FakeClient;
  function makeInteraction(name: string, opts: Partial<any> = {}) {
    return { commandName: name, isChatInputCommand: () => true, isContextMenuCommand: () => false, isAutocomplete: () => false, replied:false, deferred:false, reply: jest.fn(async ()=>{}), followUp: jest.fn(async()=>{}), user: { id: opts.userId || 'user1' }, memberPermissions: opts.memberPermissions, guild: opts.guild || null, member: opts.member || null };
  }
  function makeAutocomplete(name: string){ return { commandName: name, isChatInputCommand: () => false, isContextMenuCommand: () => false, isAutocomplete: () => true }; }
  beforeEach(() => { client = new FakeClient(); CommandHandlerClass = require('../../../src/handlers/CommandHandler').CommandHandler; });

  test('loads commands and last duplicate overrides previous', () => {
    const handler = new CommandHandlerClass(client, {});
    const map = (handler as any).commands as Map<string, any>;
    expect(map.get('same').data.description).toBe('second');
  });

  test('loadCommands invalid module warns', () => {
    const handler = new CommandHandlerClass(client, {});
    const warned = consoleWarns.find(w => (w[0]||'').includes('Pominięto') || (w[0]||'').includes('brak eksportu'));
    expect(warned).toBeTruthy();
  });

  test('denies devOnly command for non-dev then allows dev user', async () => {
    const handler = new CommandHandlerClass(client, { devUserIds: ['dev-user'] });
    const inter1: any = makeInteraction('devcmd', { userId: 'normal' });
    await (handler as any).handleInteraction(inter1);
    expect(inter1.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('deweloperów') }));
    const inter2: any = makeInteraction('devcmd', { userId: 'dev-user' });
    await (handler as any).handleInteraction(inter2);
    expect(inter2.reply.mock.calls.find((c: any) => c[0].content.includes('deweloperów'))).toBeUndefined();
  });

  test('denies command on missing user permission', async () => {
    const handler = new CommandHandlerClass(client, {});
    const inter: any = makeInteraction('needperm', { memberPermissions: { has: () => false } });
    await (handler as any).handleInteraction(inter);
    expect(inter.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Potrzebujesz uprawnień') }));
  });

  test('allows when memberPermissions is null (no crash)', async () => {
    const handler = new CommandHandlerClass(client, {});
    const inter: any = makeInteraction('needperm', { memberPermissions: null });
    await (handler as any).handleInteraction(inter);
    expect(runSpy).toHaveBeenCalled();
  });

  test('denies when bot is missing required permissions', async () => {
    const handler = new CommandHandlerClass(client, {});
    const guild = { members: { me: { permissions: { has: () => false } } } };
    const inter: any = makeInteraction('botp', { memberPermissions: { has: () => true }, guild });
    await (handler as any).handleInteraction(inter);
    expect(inter.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Bot potrzebuje uprawnień') }));
  });

  test('run() error caught and ephemeral error sent', async () => {
    const handler = new CommandHandlerClass(client, {});
    const map = (handler as any).commands as Map<string, any>;
    const cmd = map.get('aaa'); cmd.run = async () => { throw new Error('boom'); };
    const inter: any = makeInteraction('aaa');
    await (handler as any).handleInteraction(inter);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas wykonywania komendy'));
    expect(inter.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Wystąpił błąd') }));
  });

  test('autocomplete dispatch + error swallowed', async () => {
    const handler = new CommandHandlerClass(client, {});
    const autoInter: any = makeAutocomplete('auto');
    await (handler as any).handleInteraction(autoInter);
    expect(autoSpy).toHaveBeenCalled();
    const map = (handler as any).commands as Map<string, any>; map.get('auto').autocomplete = jest.fn(async () => { throw new Error('auto boom'); });
    await (handler as any).handleInteraction(autoInter);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd autocomplete'));
  });

  test('dynamic import failure triggers logger.error and user error message', async () => {
    const handler = new CommandHandlerClass(client, {});
    const map = (handler as any).commands as Map<string, any>;
    map.get('aaa').run = async () => {
      await Promise.reject(new Error('dynamic import failed'));
    };
    const inter: any = makeInteraction('aaa');
    await (handler as any).handleInteraction(inter);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas wykonywania komendy'));
    expect(inter.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('Wystąpił błąd') }));
  });

  test('cooldown active -> blocked with info message', async () => {
    mockValidation.mockResolvedValueOnce(null);
    const handler = new CommandHandlerClass(client, {});
    const inter: any = makeInteraction('aaa', { userId: 'u1' });
    await (handler as any).handleInteraction(inter);
    mockValidation.mockResolvedValueOnce('Odczekaj jeszcze 2 sekund przed ponownym użyciem tej komendy.');
    const inter2: any = makeInteraction('aaa', { userId: 'u1' });
    await (handler as any).handleInteraction(inter2);
    expect(inter2.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Odczekaj jeszcze') }));
    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  test('devRoleIds role-based allow for devOnly command', async () => {
    const handler = new CommandHandlerClass(client, { devRoleIds: ['dev-role'] });
    const inter: any = makeInteraction('devcmd', { userId: 'not-dev', member: { roles: { cache: new Map([['dev-role', true]]) } } });
    await (handler as any).handleInteraction(inter);
    const denial = inter.reply.mock.calls.find((c: any) => String(c[0]?.content||'').includes('deweloperów'));
    expect(denial).toBeUndefined();
    expect(runSpy).toHaveBeenCalled();
  });

  test('validations short-circuit: first returns error, second not called, run not executed', async () => {
    const handler = new CommandHandlerClass(client, {});
    mockValidation.mockResolvedValueOnce('Stop');
    blockValidation.mockResolvedValueOnce(null);
    const inter: any = makeInteraction('aaa');
    await (handler as any).handleInteraction(inter);
    expect(inter.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'Stop' }));
    expect(runSpy).not.toHaveBeenCalled();
    expect(blockValidation).not.toHaveBeenCalled();
  });

  test('respond uses followUp when already replied', async () => {
    const handler = new CommandHandlerClass(client, {});
    mockValidation.mockResolvedValueOnce('ERR');
    const inter: any = makeInteraction('aaa');
    inter.replied = true;
    await (handler as any).handleInteraction(inter);
    expect(inter.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: 'ERR' }));
    expect(inter.reply).not.toHaveBeenCalled();
  });

  test('respond uses followUp when deferred=true', async () => {
    const handler = new CommandHandlerClass(client, {});
    mockValidation.mockResolvedValueOnce('ERR2');
    const inter: any = makeInteraction('aaa');
    inter.deferred = true;
    await (handler as any).handleInteraction(inter);
    expect(inter.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: 'ERR2' }));
    expect(inter.reply).not.toHaveBeenCalled();
  });

  test('bulkRegister clears and registers global and dev commands', async () => {
    const appSet = jest.fn(async () => []);
    client.application.commands.set = appSet;
    const devSet = jest.fn(async () => []);
    client.guilds.fetch.mockResolvedValue({ commands: { set: devSet }, name: 'DevGuild' });
    const handler = new CommandHandlerClass(client, { bulkRegister: true, devGuildIds: ['g1'] });
    (client as any).emit('ready');
    await new Promise(r => setImmediate(r));
  const globalArgs: any[] = (appSet as any).mock.lastCall || [];
  const globalLen = (globalArgs[0] || []).length;
  expect(globalLen).toBeGreaterThan(0);
  expect(devSet).toHaveBeenCalled();
  const devArgs: any[] = (devSet as any).mock.lastCall || [];
  const devLen = (devArgs[0] || []).length;
    expect(devLen).toBe(1);
  });

  test('non-bulk: create new, edit changed, skip unchanged; deleted option skipped', async () => {
    const handler = new CommandHandlerClass(client, {});
    const map = (handler as any).commands as Map<string, any>;
    expect(map.has('deleted')).toBe(true);
    const createSpy = jest.fn();
    const editSpy = jest.fn();
    const existing = [ { id: '1', name: 'same', description: 'outdated' }, { id: '2', name: 'needperm', description: 'd' } ];
    client.application.commands.fetch = jest.fn(async () => ({ find: (fn: any) => existing.find(fn) }));
    client.application.commands.create = createSpy;
    client.application.commands.edit = editSpy;
    await (handler as any).registerCommands();
    expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(editSpy).toHaveBeenCalledTimes(1);
  });

  test('bulk=true with no devGuildIds does not fetch guilds', async () => {
    const appSet = jest.fn(async () => []);
    client.application.commands.set = appSet;
    const handler = new CommandHandlerClass(client, { bulkRegister: true });
    (client as any).emit('ready');
    await new Promise((r) => setImmediate(r));
    expect(client.guilds.fetch).not.toHaveBeenCalled();
  });

  test('bulk dev guild fetch returns null -> warns and continues', async () => {
    const appSet = jest.fn(async () => []);
    client.application.commands.set = appSet;
    client.guilds.fetch.mockResolvedValue(null);
    const handler = new CommandHandlerClass(client, { bulkRegister: true, devGuildIds: ['gX'] });
    (client as any).emit('ready');
    await new Promise((r) => setImmediate(r));
    const warned = consoleWarns.find((w) => String(w[0] || '').includes('Nie udało się pobrać gildii'));
    expect(warned).toBeTruthy();
  });

  test('non-bulk: dev guild fetch returns null -> warns and continues', async () => {
    const handler = new CommandHandlerClass(client, { devGuildIds: ['gY'] });
    client.guilds.fetch.mockResolvedValue(null);
    client.application.commands.fetch = jest.fn(async () => ({ find: (_fn: any) => undefined }));
    await (handler as any).registerCommands();
    const warned = consoleWarns.find((w) => String(w[0] || '').includes('Nie udało się pobrać gildii'));
    expect(warned).toBeTruthy();
  });

  test('ready handler: bulkRegister errors are caught and logged', async () => {
    const appSet = jest.fn(async () => { throw new Error('set failure'); });
    client.application.commands.set = appSet;
    const handler = new CommandHandlerClass(client, { bulkRegister: true });
    (client as any).emit('ready');
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalled();
  });

  test('clearCommands dev cleanup warns on error', async () => {
    const handler = new CommandHandlerClass(client, { devGuildIds: ['g1'] });
    client.guilds.fetch.mockRejectedValue(new Error('fetch fail'));
    await (handler as any).clearCommands();
    expect(consoleWarns.find(w => String(w[0]||'').includes('Nie udało się wyczyścić komend'))).toBeTruthy();
  });

  test('non-bulk dev commands per-guild: edit existing and create new', async () => {
    const handler = new CommandHandlerClass(client, { devGuildIds: ['devGuild1'] });
    const map = (handler as any).commands as Map<string, any>;
    const devCmd = map.get('devcmd');
    devCmd.data.setDescription('newdesc');
    const { SlashCommandBuilder } = require('discord.js');
    const newRun = jest.fn(async () => {});
    map.set('devnew', { data: new SlashCommandBuilder().setName('devnew').setDescription('d'), options: { devOnly: true }, run: newRun });

    const createSpy = jest.fn();
    const editSpy = jest.fn();
    const existing = [{ id: 'd1', name: 'devcmd', description: 'old desc' }];
    const guildMock = {
      name: 'Dev1',
      commands: {
        fetch: jest.fn(async () => ({ find: (fn: any) => existing.find(fn) })),
        create: createSpy,
        edit: editSpy,
      },
    };
    client.guilds.fetch.mockResolvedValue(guildMock);
  client.application.commands.fetch = jest.fn(async () => ({ find: (fn: any) => [] as any }));

    await (handler as any).registerCommands();

    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});
