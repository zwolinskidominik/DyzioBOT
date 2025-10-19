import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import { AutoRoleModel } from '../../../src/models/AutoRole';

describe('Model AutoRole', () => {
  beforeAll(async () => { await connectTestDb(); await AutoRoleModel.ensureIndexes(); });
  afterEach(async () => { await clearDatabase(); });
  afterAll(async () => { await disconnectTestDb(); });

  test('creates with default empty roleIds', async () => {
    const doc = await AutoRoleModel.create({ guildId: 'guildA' });
    expect(doc.roleIds).toEqual([]);
  });

  test('requires guildId', async () => {
    await expect(AutoRoleModel.create({} as any)).rejects.toThrow();
  });

  test('unique guildId enforced (second create fails)', async () => {
    await AutoRoleModel.create({ guildId: 'guildB', roleIds: ['r1'] });
    await expect(AutoRoleModel.create({ guildId: 'guildB', roleIds: ['r2'] })).rejects.toThrow();
  });

  test('append roleIds and save persists array', async () => {
    const doc = await AutoRoleModel.create({ guildId: 'guildC', roleIds: ['x'] });
    doc.roleIds.push('y');
    await doc.save();
    const reloaded = await AutoRoleModel.findOne({ guildId: 'guildC' }).lean();
    expect(reloaded?.roleIds).toEqual(['x','y']);
  });
});
