import run from '../../../../src/events/clientReady/sendTournamentRules';

let scheduled: Function[] = [];
jest.mock('node-cron', () => ({ schedule: (_e:string, cb:Function)=> { scheduled.push(cb); return {}; } }));
const warn = jest.fn(); const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a) } }));
jest.mock('../../../../src/config', () => ({ env: () => ({ TOURNAMENT_CHANNEL_ID: 'tour1' }) }));
jest.mock('../../../../src/config/guild', () => ({
  getGuildConfig: () => ({
    roles: { tournamentParticipants: 'role1', tournamentOrganizer: 'orgRole' },
    channels: { tournamentVoice: 'voice1' },
    tournament: { organizerUserIds: ['user1', 'user2'] }
  })
}));

function makeClient(sendImpl?: (arg:any)=>any, reactImpl?: ()=>any){
  const react = jest.fn(async () => { if(reactImpl) return reactImpl(); });
  const send = jest.fn(async (payload:any) => sendImpl ? await sendImpl(payload) : ({ react }));
  const guild = { id: 'guild123' };
  const channel = { type: 0, send, guild };
  const client = { channels: { cache: { get: (id:string)=> id==='tour1'? channel : null } } } as any;
  return { client, send, react };
}

describe('clientReady/sendTournamentRules', () => {
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
    
    jest.doMock('node-cron', () => ({ 
      schedule: (_e:string, cb:Function)=> { localScheduled.push(cb); return {}; } 
    }));
    jest.doMock('../../../../src/utils/logger', () => ({ 
      __esModule: true, 
      default: { 
        warn: (...a:any)=> localWarn(a.join(' ')), 
        error: jest.fn() 
      } 
    }));
    jest.doMock('../../../../src/config', () => ({ 
      env: () => ({}) 
    }));
    
    const mod = await import('../../../../src/events/clientReady/sendTournamentRules');
    const runLocal = (mod as any).default;
    
    await runLocal({ channels: { cache: { get: () => null } } });
    
    expect(localScheduled.length).toBe(1);
    await localScheduled[0]();
    
    expect(localWarn).toHaveBeenCalledWith(expect.stringContaining('Brak zmiennej środowiskowej TOURNAMENT_CHANNEL_ID'));
  });

  test('channel exists but is not text/announcement -> warns and returns', async () => {
    const badTypeClient = (() => {
      const send = jest.fn();
      const guild = { id: 'guild123' };
      const channel = { type: 2, send, guild };
      const client = { channels: { cache: { get: (id:string)=> id==='tour1'? channel : null } } } as any;
      return { client };
    })();
    await run(badTypeClient.client as any);
    await scheduled[0]();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Kanał do wysyłania zasad turnieju nie istnieje lub nie jest tekstowy'));
  });
});
