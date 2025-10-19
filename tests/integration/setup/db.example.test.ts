import { dbManager, setupDatabase, teardownDatabase, cleanDatabase } from '../setup/db';

/**
 * Example integration test demonstrating DbManager usage
 */
describe('DbManager Integration Test', () => {
  // Global setup - start MongoDB before all tests
  beforeAll(async () => {
    await setupDatabase();
  });

  // Global teardown - stop MongoDB after all tests
  afterAll(async () => {
    await teardownDatabase();
  });

  // Clean database before each test for isolation
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

// Export for use in other test files
export {
  setupDatabase,
  teardownDatabase, 
  cleanDatabase,
  dbManager
};