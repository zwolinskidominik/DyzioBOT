import { dbManager } from '../setup/db';
import logger from '../../../src/utils/logger';

/**
 * Global setup for integration tests
 * Runs once before all test suites
 */
module.exports = async function globalSetup() {
  logger.info('Starting integration test global setup...');
  
  try {
    // Start MongoDB test server
    await dbManager.startDb();
    logger.info('Integration test environment ready');
  } catch (error) {
    logger.error('Failed to setup integration test environment:', error);
    throw error;
  }
};