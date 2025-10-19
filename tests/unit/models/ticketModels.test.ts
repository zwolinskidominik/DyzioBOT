import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import { TicketConfigModel, TicketConfigDocument } from '../../../src/models/TicketConfig';
import { TicketStateModel, TicketStateDocument } from '../../../src/models/TicketState';
import { TicketStatsModel, TicketStatsDocument } from '../../../src/models/TicketStats';

beforeAll(async () => {
  await connectTestDb();
  await Promise.all([
    TicketConfigModel.ensureIndexes(),
    TicketStateModel.ensureIndexes(),
    TicketStatsModel.ensureIndexes(),
  ]);
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Ticket models', () => {
  test('TicketConfig: create with required fields', async () => {
    const cfg = await new TicketConfigModel({ guildId: '1', categoryId: '10' }).save();
    expect(cfg.guildId).toBe('1');
    expect(cfg.categoryId).toBe('10');

    // unique per guild
    await expect(new TicketConfigModel({ guildId: '1', categoryId: '11' }).save()).rejects.toBeDefined();
  });

  test('TicketState: default assignedTo is null and assign/unassign flow', async () => {
    const st = await new TicketStateModel({ channelId: '222' }).save();
    // default is null per model
    expect(st.assignedTo).toBeNull();

    st.assignedTo = 'userA';
    await st.save();
    const re = await TicketStateModel.findOne({ channelId: '222' }).exec() as TicketStateDocument;
    expect(re.assignedTo).toBe('userA');

    // unassign
    re.assignedTo = null as unknown as string;
    await re.save();
    const re2 = await TicketStateModel.findOne({ channelId: '222' }).lean().exec();
    expect(re2?.assignedTo).toBeNull();
  });

  test('TicketStats: default counters and increment statistics', async () => {
    const s1 = await new TicketStatsModel({ guildId: '1', userId: 'u1' }).save();
    expect(s1.count).toBe(0);

    await TicketStatsModel.updateOne({ guildId: '1', userId: 'u1' }, { $inc: { count: 1 } }).exec();
    const re = await TicketStatsModel.findOne({ guildId: '1', userId: 'u1' }).exec() as TicketStatsDocument;
    expect(re.count).toBe(1);

    // another user untouched
    await new TicketStatsModel({ guildId: '1', userId: 'u2' }).save();
    const two = await TicketStatsModel.findOne({ guildId: '1', userId: 'u2' }).lean().exec();
    expect(two?.count).toBe(0);
  });
});
