import { dbManager, setupDatabase, teardownDatabase, cleanDatabase } from '../setup/db';

describe('DbManager Integration Test', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should connect to test database', () => {
    expect(dbManager.connected).toBe(true);
    expect(dbManager.uri).toBeDefined();
  });

  it('should clear collections successfully', async () => {
    await dbManager.clearCollections();
    expect(dbManager.connected).toBe(true);
  });
});

export {
  setupDatabase,
  teardownDatabase, 
  cleanDatabase,
  dbManager
};