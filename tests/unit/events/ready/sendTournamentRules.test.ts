import run from '../../../../src/events/ready/sendTournamentRules';

let scheduled: Function[] = [];
jest.mock('node-cron', () => ({ schedule: (_e:string, cb:Function)=> { scheduled.push(cb); return {}; } }));
const warn = jest.fn(); const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a) } }));
jest.mock('../../../../src/config', () => ({ env: () => ({ TOURNAMENT_CHANNEL_ID: 'tour1' }) }));

function makeClient(sendImpl?: (arg:any)=>any, reactImpl?: ()=>any){
  const react = jest.fn(async () => { if(reactImpl) return reactImpl(); });
  const send = jest.fn(async (payload:any) => sendImpl ? await sendImpl(payload) : ({ react }));
  const channel = { type: 0, send };
  const client = { channels: { cache: { get: (id:string)=> id==='tour1'? channel : null } } } as any;
  return { client, send, react };
}

describe('ready/sendTournamentRules', () => {
  beforeEach(()=> { scheduled=[]; warn.mockReset(); error.mockReset(); });

  test('cron registration + success sends rules and reacts', async () => {
    const { client, send } = makeClient();
    await run(client);
    expect(scheduled.length).toBe(1);
    await scheduled[0]();
    expect(send).toHaveBeenCalled();
  });

  test('error path logs error', async () => {
    const { client } = makeClient(async ()=> { throw new Error('sendFail'); });
    await run(client);
    await scheduled[0]();
    const hit = error.mock.calls.find(c=> (c[0]||'').includes('Błąd wysyłania zasad'));
    expect(hit).toBeTruthy();
  });

  test('missing env var -> warns and returns early', async () => {
    jest.resetModules();
    const localScheduled: Function[] = [];
    const localWarn = jest.fn();
    await jest.isolateModulesAsync(async () => {
      jest.doMock('node-cron', () => ({ schedule: (_e:string, cb:Function)=> { localScheduled.push(cb); return {}; } }));
      jest.doMock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=> localWarn(a.join? a.join(' '): a), error: jest.fn() } }));
      jest.doMock('../../../../src/config', () => ({ env: () => ({ /* no TOURNAMENT_CHANNEL_ID */ }) }));
      const mod = await import('../../../../src/events/ready/sendTournamentRules');
      const runLocal = mod.default as (c:any)=>Promise<void>;
      await runLocal({ channels: { cache: { get: () => null } } } as any);
      // Trigger cron callback
      await localScheduled[0]();
      expect(localWarn).toHaveBeenCalledWith(expect.stringContaining('Brak zmiennej środowiskowej TOURNAMENT_CHANNEL_ID'));
    });
  });

  test('channel exists but is not text/announcement -> warns and returns', async () => {
    const badTypeClient = (() => {
      const send = jest.fn();
      const channel = { type: 2, send }; // GuildVoice (not allowed)
      const client = { channels: { cache: { get: (id:string)=> id==='tour1'? channel : null } } } as any;
      return { client };
    })();
    await run(badTypeClient.client as any);
    await scheduled[0]();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Kanał do wysyłania zasad turnieju nie istnieje lub nie jest tekstowy'));
  });
});
