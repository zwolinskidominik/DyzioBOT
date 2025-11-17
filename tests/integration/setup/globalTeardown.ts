import { dbManager } from '../setup/db';
import logger from '../../../src/utils/logger';

module.exports = async function globalTeardown() {
  logger.info('Starting integration test global teardown...');
  
  try {
    await dbManager.stopDb();
    logger.info('Integration test cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup integration test environment:', error);
  }
};