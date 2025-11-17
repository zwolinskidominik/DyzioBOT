let scheduled: Function[] = [];
jest.mock('node-cron', () => ({ schedule: (_expr:string, cb:Function)=> { scheduled.push(cb); return {}; } }));

const info = jest.fn();
const warn = jest.fn();
const error = jest.fn();
const debug = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { info: (...a:any)=>info(a.join? a.join(' '): a), warn: (...a:any)=>warn(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a), debug: (...a:any)=>debug(a.join? a.join(' '): a) } }));

jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ ...o, addFields(){return this;} }) }));

const pickWinnersImpl = jest.fn(async (_participants:string[], _count:number)=> [] as any[]);
jest.mock('../../../../src/utils/giveawayHelpers', () => ({ pickWinners: (p:string[], c:number) => pickWinnersImpl(p,c) }));

jest.mock('../../../../src/config/constants/colors', () => ({ COLORS: { GIVEAWAY_ENDED: 0x00ff00 } }));

interface GiveawayDoc {
  _id: string;
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  participants: string[];
  winnersCount: number;
  prize: string;
  description: string;
  hostId: string;
  endTime: Date;
  finalized: boolean;
  active: boolean;
}

let candidatesList: GiveawayDoc[] = [];
let processingQueue: GiveawayDoc[] = [];
const updateOneMock = jest.fn();

const findMock = jest.fn(async () => candidatesList);
const findOneAndUpdateMock = jest.fn(async () => processingQueue.shift() || null);

jest.mock('../../../../src/models/Giveaway', () => ({
  GiveawayModel: {
    find: () => ({ select: () => ({ sort: () => ({ lean: () => findMock() }) }) }),
    findOneAndUpdate: (..._a:any[]) => findOneAndUpdateMock(),
    updateOne: (...a:any[]) => updateOneMock(...a),
  },
}));

function makeBaseGiveaway(overrides: Partial<GiveawayDoc> = {}): GiveawayDoc {
  return {
    _id: 'id1',
    giveawayId: 'g1',
    guildId: 'guild1',
    channelId: 'channel1',
    messageId: 'msg1',
    participants: [],
    winnersCount: 1,
    prize: 'Nagroda',
    description: 'Opis',
    hostId: 'host1',
    endTime: new Date(Date.now() - 1000),
    finalized: false,
    active: true,
    ...overrides,
  };
}

function makeClient(options: any = {}) {
  const edit = jest.fn().mockResolvedValue(undefined);
  const reply = jest.fn().mockResolvedValue(undefined);
  const send = jest.fn().mockResolvedValue(undefined);
  const fetch = jest.fn().mockImplementation(async (id:string) => ({ id, edit, reply }));
  if (options.replyFail) {
    reply.mockImplementationOnce(async () => { throw new Error('reply fail'); });
  }
  const messageObj = { id: 'msg1', edit, reply };
  const messagesFetch = jest.fn(async (id:string) => id === 'msg1' ? messageObj : null);
  const channel = { messages: { fetch: messagesFetch }, send };
  const channelsCache = new Map<string, any>([['channel1', options.noChannel ? undefined : channel]]);
  const guild = options.noGuild ? undefined : { channels: { cache: { get: (id:string) => channelsCache.get(id) } } };
  const guildsCache = new Map<string, any>([['guild1', guild]]);
  const client = { guilds: { cache: guildsCache } } as any;
  return { client, edit, reply, send, messagesFetch, channel };
}

import giveawayScheduler from '../../../../src/events/ready/giveawayScheduler';

function resetState() {
  scheduled = [];
  info.mockReset(); warn.mockReset(); error.mockReset(); debug.mockReset();
  candidatesList = []; processingQueue = []; updateOneMock.mockReset();
  findMock.mockClear(); findOneAndUpdateMock.mockClear(); pickWinnersImpl.mockClear();
}

async function runSchedulerCallback() {
  expect(scheduled.length).toBe(1);
  await scheduled[0]();
  await Promise.resolve();
}

describe('ready/giveawayScheduler', () => {
  beforeEach(resetState);

  test('single giveaway processed updates embed', async () => {
    const g = makeBaseGiveaway({ participants: ['u1','u2'] });
    candidatesList = [g]; processingQueue = [g];
  pickWinnersImpl.mockImplementationOnce(async ()=> [{ id: 'u1' }]);
    const { client, edit } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    expect(edit).toHaveBeenCalled();
    const editArg = edit.mock.calls[0][0];
    expect(editArg.embeds[0].description).toContain('Nagroda');
  });

  test('missing guild warns and continues', async () => {
    const g = makeBaseGiveaway();
    candidatesList = [g]; processingQueue = [g];
    const { client } = makeClient({ noGuild: true });
    await giveawayScheduler(client);
    await runSchedulerCallback();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono serwera'));
  });

  test('missing channel warns', async () => {
    const g = makeBaseGiveaway();
    candidatesList = [g]; processingQueue = [g];
    const { client } = makeClient({ noChannel: true });
    await giveawayScheduler(client);
    await runSchedulerCallback();
    const hit = warn.mock.calls.find(c=> (c[0]||'').includes('Nie znaleziono kanału'));
    expect(hit).toBeTruthy();
  });

  test('no winners but participants triggers warn', async () => {
    const g = makeBaseGiveaway({ participants: ['u1','u2','u3'] });
    candidatesList = [g]; processingQueue = [g];
  pickWinnersImpl.mockImplementationOnce(async ()=> []);
    const { client } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    const hit = warn.mock.calls.find(c=> (c[0]||'').includes('Brak zwycięzców mimo uczestników'));
    expect(hit).toBeTruthy();
  });

  test('reply failure falls back to channel.send', async () => {
    const g = makeBaseGiveaway({ participants: ['u1'] });
    candidatesList = [g]; processingQueue = [g];
  pickWinnersImpl.mockImplementationOnce(async ()=> [{ id: 'u1' }]);
    const { client, send, reply } = makeClient({ replyFail: true });
    await giveawayScheduler(client);
    await runSchedulerCallback();
    expect(reply).toHaveBeenCalled();
    expect(send).toHaveBeenCalled();
    const warnHit = warn.mock.calls.find(c=> (c[0]||'').includes('reply (spróbuję channel.send)'));
    expect(warnHit).toBeTruthy();
  });

  test('finalize update failure logs error', async () => {
    const g = makeBaseGiveaway({ participants: ['u1'] });
    candidatesList = [g]; processingQueue = [g];
  pickWinnersImpl.mockImplementationOnce(async ()=> [{ id: 'u1' }]);
    updateOneMock.mockImplementationOnce(async () => { throw new Error('finalizeFail'); });
    const { client } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    const errHit = error.mock.calls.find(c=> (c[0]||'').includes('finalized=true'));
    expect(errHit).toBeTruthy();
  });

  test('no giveaways to process -> skip (no info/warn)', async () => {
    candidatesList = []; processingQueue = [];
    const { client } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    expect(info).not.toHaveBeenCalled();
    const schedulerWarn = warn.mock.calls.find(c=> (c[0]||'').includes('Scheduler: znaleziono'));
    expect(schedulerWarn).toBeUndefined();
  });

  test('one missing channel then second giveaway processed', async () => {
    const g1 = makeBaseGiveaway({ giveawayId: 'gMissing', channelId: 'missingChannel' });
    const g2 = makeBaseGiveaway({ giveawayId: 'g2', _id: 'id2', messageId: 'msg2', channelId: 'channel1', participants: ['p1'] });
    candidatesList = [g1, g2]; processingQueue = [g1, g2];
    pickWinnersImpl.mockImplementationOnce(async ()=> [{ id: 'p1' }]);
    const { client } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    const missingWarn = warn.mock.calls.find(c=> (c[0]||'').includes('Nie znaleziono kanału') && (c[0]||'').includes('gMissing'));
    expect(missingWarn).toBeTruthy();
  });

  test('finalize full success updates message and sets finalized', async () => {
    const g = makeBaseGiveaway({ participants: ['u1','u2'], winnersCount: 1 });
    candidatesList = [g]; processingQueue = [g];
    pickWinnersImpl.mockImplementationOnce(async ()=> [{ id: 'u2' }]);
    const { client, edit, reply } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    expect(edit).toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
    const updateCall = updateOneMock.mock.calls.find(c=> c[1]?.['$set']?.finalized === true);
    expect(updateCall).toBeTruthy();
  });

  test('pickWinners empty list but participants -> embed shows Brak zwycięzców', async () => {
    const g = makeBaseGiveaway({ participants: ['u1','u2'], winnersCount: 1 });
    candidatesList = [g]; processingQueue = [g];
    pickWinnersImpl.mockImplementationOnce(async ()=> []);
    const { client, edit } = makeClient();
    await giveawayScheduler(client);
    await runSchedulerCallback();
    const editArg = edit.mock.calls[0][0];
    expect(editArg.embeds[0].description).toContain('Brak zwycięzców');
    const warnHit = warn.mock.calls.find(c=> (c[0]||'').includes('Brak zwycięzców mimo uczestników'));
    expect(warnHit).toBeTruthy();
  });
});
