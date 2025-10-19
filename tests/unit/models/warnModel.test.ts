import { WarnModel } from '../../../src/models/Warn';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Warn Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await WarnModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('sets default date on warn entries when not provided', async () => {
    const start = Date.now();
    const doc = await WarnModel.create({
      userId: 'user-1',
      guildId: 'guild-1',
      warnings: [
        { reason: 'spam', moderator: 'mod-1' },
      ],
    });

    expect(doc.warnings).toHaveLength(1);
    const date = doc.warnings[0].date as unknown as Date;
    expect(date instanceof Date).toBe(true);
    const diff = Math.abs(date.getTime() - start);
    expect(diff).toBeLessThan(2000); // within 2 seconds of creation time
  });

  it('can be sorted to show newest warnings first', async () => {
    const older = new Date('2024-01-01T00:00:00.000Z');
    const middle = new Date('2024-06-01T00:00:00.000Z');
    const newest = new Date('2024-12-31T23:59:59.000Z');

    await WarnModel.create({
      userId: 'user-2',
      guildId: 'guild-1',
      warnings: [
        { reason: 'A-old', moderator: 'm', date: older },
        { reason: 'B-mid', moderator: 'm', date: middle },
        { reason: 'C-new', moderator: 'm', date: newest },
      ],
    });

    const found = await WarnModel.findOne({ userId: 'user-2', guildId: 'guild-1' }).lean();
    expect(found).toBeTruthy();
    const sorted = [...(found!.warnings as any[])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    expect(sorted.map(w => w.reason)).toEqual(['C-new', 'B-mid', 'A-old']);
  });
});
