import run from '../../../../src/events/clientReady/warnSystemMaintenance';

let scheduled: Function[] = [];
jest.mock('node-cron', () => ({ schedule: (_e:string, cb:Function)=> { scheduled.push(cb); return {}; } }));

const info = jest.fn(); const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { info: (...a:any)=>info(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a) } }));
process.env.GUILD_ID = 'guild1';

const findWarns = jest.fn();
jest.mock('../../../../src/models/Warn', () => ({ WarnModel: { find: (q:any)=> ({ exec: () => findWarns(q) }) } }));

function makeWarnDoc(oldCount:number, newCount:number){
  return { userId: 'u1', warnings: [ { date: new Date(Date.now() - oldCount) }, { date: new Date(Date.now() - newCount) } ], save: jest.fn(async()=>{}) } as any;
}

describe('clientReady/warnSystemMaintenance', () => {
  beforeEach(()=> { scheduled=[]; info.mockReset(); error.mockReset(); findWarns.mockReset(); });

  test('cron registration + success removes expired and logs info', async () => {
    const expiredMs = 110*24*3600*1000;
    const freshMs = 20*24*3600*1000;
    const doc = makeWarnDoc(expiredMs, freshMs);
    findWarns.mockResolvedValue([doc]);
    await run();
    expect(scheduled.length).toBe(1);
    await scheduled[0]();
    expect(info).toHaveBeenCalled();
  });

  test('error path logs error', async () => {
    findWarns.mockImplementation(()=> { throw new Error('findFail'); });
    await run();
    await scheduled[0]();
    const hit = error.mock.calls.find(c=> (c[0]||'').includes('Błąd podczas utrzymania'));
    expect(hit).toBeTruthy();
  });

  test('no expired warnings -> no save and no info log', async () => {
    const doc:any = { userId: 'u1', warnings: [ { date: new Date() }, { date: new Date(Date.now() - 5*24*3600*1000) } ], save: jest.fn(async()=>{}) };
    findWarns.mockResolvedValue([doc]);
    await run();
    await scheduled[0]();
    expect(doc.save).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test('save failure on one document logs error and stops processing others', async () => {
    const expiredMs = 100*24*3600*1000;
    const freshMs = 5*24*3600*1000;
    const failing:any = makeWarnDoc(expiredMs, freshMs);
    failing.save = jest.fn(async()=> { throw new Error('savefail'); });
    const second:any = makeWarnDoc(expiredMs, freshMs);
    findWarns.mockResolvedValue([failing, second]);
    await run();
    await scheduled[0]();
    const errHit = error.mock.calls.find(c=> (c[0]||'').includes('Błąd podczas utrzymania'));
    expect(errHit).toBeTruthy();
    expect(failing.save).toHaveBeenCalled();
    expect(second.save).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
