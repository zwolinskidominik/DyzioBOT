import questionScheduler from '../../../../src/events/ready/questionScheduler';
import birthdayScheduler from '../../../../src/events/ready/birthdayScheduler';

let scheduled: { expr: string, cb: Function }[] = [];
jest.mock('node-cron', () => ({ schedule: (expr:string, cb:Function)=> { scheduled.push({ expr, cb }); return {}; } }));

const warn = jest.fn(); const error = jest.fn(); const info = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.map(String).join(' ')), error: (...a:any)=>error(a.map(String).join(' ')), info: (...a:any)=>info(a.map(String).join(' ')) } }));

jest.mock('../../../../src/config', () => ({ env: () => ({ GUILD_ID: 'guild1' }) }));

const findOneQCfg = jest.fn();
const qFind = jest.fn();
const qDelete = jest.fn();
jest.mock('../../../../src/models/QuestionConfiguration', () => ({ QuestionConfigurationModel: { findOne: (q:any)=> findOneQCfg(q) } }));
jest.mock('../../../../src/models/Question', () => ({ QuestionModel: { find: () => qFind(), findByIdAndDelete: (...a:any[]) => qDelete(...a) } }));

const findBirthdayCfgs = jest.fn();
const findBirthdays = jest.fn();
jest.mock('../../../../src/models/BirthdayConfiguration', () => ({ BirthdayConfigurationModel: { find: (q:any)=> findBirthdayCfgs(q) } }));
jest.mock('../../../../src/models/Birthday', () => ({ BirthdayModel: { find: (q:any)=> findBirthdays(q) } }));

function makeClient(){
  const send = jest.fn(async ()=>({}));
  const channel = { send, threads: { create: jest.fn() } };
  const channels = { cache: { get: (id:string)=> channel } };
  const fetch = jest.fn(async (id:string)=> ({ id, roles: { add: jest.fn() } }));
  const members = { fetch };
  const guild = { channels, members };
  const guilds = { cache: { get: (id:string)=> guild } };
  return { channels, guilds, users: { fetch: jest.fn(async (id:string)=> ({ id })) }, _internals: { send } } as any;
}

describe('ready/schedulers isolation', () => {
  beforeEach(() => { scheduled = []; warn.mockReset(); error.mockReset(); info.mockReset(); findOneQCfg.mockReset(); qFind.mockReset(); qDelete.mockReset(); findBirthdayCfgs.mockReset(); findBirthdays.mockReset(); });
  afterEach(() => { jest.clearAllMocks(); });

  test('exception in question job does not block birthday job', async () => {
    findOneQCfg.mockImplementation(() => { throw new Error('questionJobBoom'); });

    findBirthdayCfgs.mockResolvedValue([{ birthdayChannelId: 'chan1', guildId: 'guild1' }]);
    findBirthdays.mockResolvedValue([]);

    const client = makeClient();
    await questionScheduler(client as any);
    await birthdayScheduler(client as any);

    expect(scheduled.length).toBe(2);

    await scheduled[0].cb();
    await scheduled[1].cb();

    expect(warn.mock.calls.some(c => String(c[0]).includes('Kanał urodzinowy') || String(c[0]).includes('Konfiguracja urodzin nie istnieje'))).toBe(true);
    expect(error.mock.calls.some(c => String(c[0]).includes('Błąd wysyłania pytania dnia'))).toBe(true);
  });
});
