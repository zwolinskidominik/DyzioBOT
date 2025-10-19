import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { TicketStateModel } from '../../../src/models/TicketState';

describe('TicketState Model (integration)', () => {
  let db: DbManager;

  beforeAll(async () => {
    db = new DbManager();
    await db.startDb();
  });

  afterAll(async () => {
    await db.stopDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
  });

  it('create with default assignedTo null and update/unassign', async () => {
    const created = await TicketStateModel.create({ channelId: 'ch1' });
    expect(created.assignedTo).toBeNull();
    created.assignedTo = 'u1';
    await created.save();
    const afterAssign = await TicketStateModel.findOne({ channelId: 'ch1' });
    expect(afterAssign?.assignedTo).toBe('u1');
    afterAssign!.assignedTo = null as any;
    await afterAssign!.save();
    const final = await TicketStateModel.findOne({ channelId: 'ch1' }).lean();
    expect(final?.assignedTo).toBeNull();
  });

  it('unique channelId enforced', async () => {
    await TicketStateModel.create({ channelId: 'uniqueA' });
    await expect(TicketStateModel.create({ channelId: 'uniqueA' })).rejects.toThrow(/duplicate key/i);
  });
});
