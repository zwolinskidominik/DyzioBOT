import run from '../../../../src/events/clientReady/questionScheduler';

let scheduled: Function[] = [];
jest.mock('node-cron', () => ({ schedule: (_expr:string, cb:Function)=> { scheduled.push(cb); return {}; } }));

const warn = jest.fn(); const error = jest.fn(); const info = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a), info: (...a:any)=>info(a.join? a.join(' '): a) } }));

jest.mock('../../../../src/config', () => ({ env: () => ({ GUILD_ID: 'guild1' }) }));

const findOneCfg = jest.fn();
jest.mock('../../../../src/models/QuestionConfiguration', () => ({ QuestionConfigurationModel: { findOne: (q:any)=> findOneCfg(q) } }));

const questionFind = jest.fn();
const findByIdAndDelete = jest.fn();
jest.mock('../../../../src/models/Question', () => ({ QuestionModel: { find: () => questionFind(), findByIdAndDelete: (...a:any[]) => findByIdAndDelete(...a) } }));

function makeClient(){
  const react = jest.fn();
  const send = jest.fn(async (content:any)=> ({ react }));
  const threadsCreate = jest.fn();
  const channel = { send, threads: { create: threadsCreate } };
  const channels = { cache: { get: (id:string)=> id==='qchan' ? channel : null } };
  return { channels, _internals: { react, send, threadsCreate, channel } } as any;
}

async function runSched(){ await scheduled[0](); }

describe('clientReady/questionScheduler', () => {
  beforeEach(()=> { scheduled=[]; warn.mockReset(); error.mockReset(); info.mockReset(); findOneCfg.mockReset(); questionFind.mockReset(); findByIdAndDelete.mockReset(); });

  test('registers cron and success path posts question & reactions', async () => {
    findOneCfg.mockResolvedValue({ questionChannelId: 'qchan', pingRoleId: null });
    questionFind.mockResolvedValue([{ _id: 'idq', content: 'Treść pytania', reactions: ['👍','👎'] }]);
    const client = makeClient();
    await run(client);
    expect(scheduled.length).toBe(1);
    await runSched();
    const channel = client.channels.cache.get('qchan');
    expect(channel.send).toHaveBeenCalled();
    const reactFn = (await channel.send.mock.results[0].value).react;
    expect(reactFn).toBeDefined();
    expect(findByIdAndDelete).toHaveBeenCalledWith('idq');
  });

  test('error path logs error', async () => {
    findOneCfg.mockImplementation(()=> { throw new Error('cfgErr'); });
    const client = makeClient();
    await run(client);
    await runSched();
    const hit = error.mock.calls.find(c=> (c[0]||'').includes('Błąd wysyłania pytania dnia'));
    expect(hit).toBeTruthy();
  });

  test('no questions -> skip after info log and send notice', async () => {
    findOneCfg.mockResolvedValue({ questionChannelId: 'qchan', pingRoleId: null });
    questionFind.mockResolvedValue([]);
    const client = makeClient();
    await run(client);
    await runSched();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('Brak pytań w bazie danych'));
    const channel = client.channels.cache.get('qchan');
    expect(channel.send).toHaveBeenCalledWith('Brak pytań w bazie danych!');
    expect(findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('reaction failure logs warn but continues deletion', async () => {
    findOneCfg.mockResolvedValue({ questionChannelId: 'qchan', pingRoleId: null });
    questionFind.mockResolvedValue([{ _id: 'idq', content: 'Q?', reactions: ['👍','👎'] }]);
    const client = makeClient();
    const reactMock = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('reactFail'));
    client._internals.send.mockImplementation(async (c:any)=> ({ react: reactMock }));
    await run(client);
    await runSched();
    const warnHit = warn.mock.calls.find(c=> (c[0]||'').includes('Błąd podczas dodawania reakcji'));
    expect(warnHit).toBeTruthy();
    expect(findByIdAndDelete).toHaveBeenCalledWith('idq');
  });

  test('thread creation failure logs error and does not delete question', async () => {
    findOneCfg.mockResolvedValue({ questionChannelId: 'qchan', pingRoleId: null });
    questionFind.mockResolvedValue([{ _id: 'idq', content: 'Treść problematyczna', reactions: [] }]);
    const client = makeClient();
    client._internals.threadsCreate.mockRejectedValue(new Error('threadFail'));
    await run(client);
    await runSched();
    const errHit = error.mock.calls.find(c=> (c[0]||'').includes('Błąd wysyłania pytania dnia'));
    expect(errHit).toBeTruthy();
    expect(client._internals.send).toHaveBeenCalled();
    expect(findByIdAndDelete).not.toHaveBeenCalled();
  });

});
