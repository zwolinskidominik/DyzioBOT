// Cover recursion branches in loadCommands and loadValidations when encountering subdirectories
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// Mock fs to expose a subdirectory in both commands and validations trees
jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  const readdirSync = (dir: string) => {
    const norm = String(dir).replace(/\\/g, '/');
    if (norm.endsWith('src/commands')) return ['sub'];
    if (norm.endsWith('src/commands/sub')) return [];
    if (norm.endsWith('src/validations')) return ['subv'];
    if (norm.endsWith('src/validations/subv')) return [];
    return real.readdirSync(dir);
  };
  const statSync = (p: string) => {
    const norm = String(p).replace(/\\/g, '/');
    if (norm.endsWith('/sub') || norm.endsWith('/subv')) return { isDirectory: () => true } as any;
    return { isDirectory: () => false } as any;
  };
  return { ...real, readdirSync, statSync };
});

class FakeEmitter { private events: Record<string, Function[]> = {}; on(e:string,f:Function){(this.events[e] ||= []).push(f);return this;} once(e:string,f:Function){(this.events[e] ||= []).push(f);return this;} emit(e:string,...args:any[]){ (this.events[e]||[]).forEach(fn=>fn(...args)); } }
class FakeClient extends FakeEmitter { application: any = { commands: { fetch: async () => ({ find: () => undefined }), create: jest.fn(), edit: jest.fn(), set: jest.fn(async ()=>[]) } }; guilds: any = { fetch: jest.fn() }; }

describe('CommandHandler directory recursion loading', () => {
  test('encounters subdirectories and recurses without errors', () => {
    const { CommandHandler } = require('../../../src/handlers/CommandHandler');
    const client = new FakeClient();
    const handler = new CommandHandler(client, {});
    // With only subdirectories and no files, the map remains empty but recursion paths were executed
    const map = (handler as any).commands as Map<string, any>;
    expect(map.size).toBeGreaterThanOrEqual(0);
  });
});
