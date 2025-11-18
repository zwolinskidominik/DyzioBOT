import birthdayScheduler from '../../../../src/events/clientReady/birthdayScheduler';
import { ChannelType } from 'discord.js';

const warn = jest.fn();
const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.map(String).join(' ')), error: (...a:any)=>error(a.map(String).join(' ')) } }));

jest.mock('../../../../src/config', () => ({ env: () => ({ GUILD_ID: 'guild1' }) }));

const findBirthdayCfgs = jest.fn();
jest.mock('../../../../src/models/BirthdayConfiguration', () => ({ BirthdayConfigurationModel: { find: (q:any)=> findBirthdayCfgs(q) } }));

const findBirthdays = jest.fn();
jest.mock('../../../../src/models/Birthday', () => ({ BirthdayModel: { find: (q:any)=> findBirthdays(q) } }));

let scheduled: { expr:string, cb: Function }[] = [];
jest.mock('node-cron', () => ({ schedule: (expr:string, cb:Function)=> { scheduled.push({ expr, cb }); return {}; } }));

function makeClient(){
  const send = jest.fn(async ()=>{});
  const channel = { type: ChannelType.GuildText, send } as any;
  const channelsCache = new Map([[ 'chan1', channel ]]);
  const fetch = jest.fn(async (id:string)=> ({ id, roles: { add: jest.fn() } }));
  const members = { fetch };
  const guild = { channels: { cache: channelsCache }, members };
  const guildsCache = new Map([[ 'guild1', guild ]]);
  return {
    channels: { cache: { get: (id:string) => channelsCache.get(id) }},
    guilds: { cache: { get: (id:string) => guildsCache.get(id) }},
    users: { fetch: jest.fn(async (id:string)=> ({ id })) },
  } as any;
}

describe('clientReady/birthdayScheduler', () => {
  beforeEach(()=> { scheduled = []; warn.mockReset(); error.mockReset(); findBirthdayCfgs.mockReset(); findBirthdays.mockReset(); });
  afterEach(() => { jest.clearAllMocks(); });

  test('registers cron and warns when no config', async () => {
    findBirthdayCfgs.mockResolvedValue([]);
    const client = makeClient();
    await birthdayScheduler(client);
    expect(scheduled.length).toBe(1);
    expect(scheduled[0].expr).toBe('0 9 * * *');
    await scheduled[0].cb();
    expect(warn).toHaveBeenCalled();
  });

  test('sends birthday wishes for today', async () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    findBirthdayCfgs.mockResolvedValue([{ birthdayChannelId: 'chan1', message: 'Wszystkiego najlepszego {user}! 🥳', guildId: 'guild1' }]);
    findBirthdays.mockResolvedValue([
      { day: day, month: month, userId: 'u1', guildId: 'guild1' },
      { day: day - 1, month: month, userId: 'u2', guildId: 'guild1' },
    ]);
    const client = makeClient();
    await birthdayScheduler(client);
    await scheduled[0].cb();
    const channel: any = (client as any).channels.cache.get('chan1');
    const sentPayloads = channel.send.mock.calls.map((c:any)=> c[0]);
    expect(sentPayloads.length).toBeGreaterThan(0);
    expect(sentPayloads.some((p:any)=> (typeof p === 'string' && p.includes('Wszystkiego najlepszego')) || (p?.content && p.content.includes('Wszystkiego najlepszego')))).toBe(true);
  });

  test('logs error on unexpected failure', async () => {
    findBirthdayCfgs.mockImplementation(() => { throw new Error('cfgBoom'); });
    const client = makeClient();
    await birthdayScheduler(client);
    await scheduled[0].cb();
    const errHit = error.mock.calls.find(c => (c[0]||'').includes('Błąd podczas wysyłania'));
    expect(errHit).toBeTruthy();
  });
});
