import { dbManager } from '../setup/db';
import logger from '../../../src/utils/logger';

/**
 * Global teardown for integration tests
 * Runs once after all test suites complete
 */
module.exports = async function globalTeardown() {
  logger.info('Starting integration test global teardown...');
  
  try {
    // Stop MongoDB test server
    await dbManager.stopDb();
    logger.info('Integration test cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup integration test environment:', error);
    // Don't throw in teardown - log error but allow tests to complete
  }
};