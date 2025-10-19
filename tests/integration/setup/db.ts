import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import logger from '../../../src/utils/logger';

export interface DbState {
  uri: string;
  server: MongoMemoryServer;
}

export class DbManager {
  private static instance: DbManager;
  private mongoServer?: MongoMemoryServer;
  private isConnected = false;

  constructor() {
    if (DbManager.instance) {
      return DbManager.instance;
    }
    DbManager.instance = this;
  }

  /**
   * Start MongoDB memory server and establish connection
   */
  async startDb(version = '7.0.14'): Promise<string> {
    try {
      if (this.mongoServer && this.isConnected) {
        logger.info('MongoDB test server already running');
        return this.mongoServer.getUri();
      }

      // Check if external TEST_MONGO_URI is provided
      const testUri = process.env.TEST_MONGO_URI;
      if (testUri) {
        await this.connectToTestDb(testUri);
        return testUri;
      }

      // Start in-memory MongoDB
      this.mongoServer = await MongoMemoryServer.create({
        binary: { version },
        instance: { 
          dbName: 'dyziobot-test',
          launchTimeout: 60000 // Increase timeout for Windows/CI
        }
      });

      const uri = this.mongoServer.getUri();
      await this.connectToTestDb(uri);
      
      logger.info(`MongoDB test server started at: ${uri}`);
      return uri;
    } catch (error) {
      logger.error('Failed to start MongoDB test server:', error);
      throw error;
    }
  }

  /**
   * Connect to test database
   */
  async connectToTestDb(uri?: string): Promise<void> {
    try {
      if (this.isConnected) {
        return;
      }

      const connectionUri = uri || this.mongoServer?.getUri();
      if (!connectionUri) {
        throw new Error('No MongoDB URI available for connection');
      }

      await mongoose.connect(connectionUri, {
        // Optimize for test environment
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      logger.info('Connected to test database');
    } catch (error) {
      logger.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  /**
   * Clear all collections in test database
   */
  async clearCollections(): Promise<void> {
    try {
      if (!this.isConnected || !mongoose.connection.db) {
        logger.warn('Not connected to database, skipping collection clearing');
        return;
      }

      const collections = await mongoose.connection.db.collections();
      
      const clearPromises = collections.map(async (collection) => {
        await collection.deleteMany({});
        logger.debug(`Cleared collection: ${collection.collectionName}`);
      });

      await Promise.all(clearPromises);
      logger.info(`Cleared ${collections.length} collections`);
    } catch (error) {
      logger.error('Failed to clear collections:', error);
      throw error;
    }
  }

  /**
   * Drop all collections (more thorough than clear)
   */
  async dropCollections(): Promise<void> {
    try {
      if (!this.isConnected || !mongoose.connection.db) {
        logger.warn('Not connected to database, skipping collection dropping');
        return;
      }

      const collections = await mongoose.connection.db.collections();
      
      const dropPromises = collections.map(async (collection) => {
        await collection.drop();
        logger.debug(`Dropped collection: ${collection.collectionName}`);
      });

      await Promise.all(dropPromises);
      logger.info(`Dropped ${collections.length} collections`);
    } catch (error) {
      logger.error('Failed to drop collections:', error);
      throw error;
    }
  }

  /**
   * Stop MongoDB server and close connection
   */
  async stopDb(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        this.isConnected = false;
        logger.info('Mongoose connection closed');
      }

      if (this.mongoServer) {
        await this.mongoServer.stop();
        this.mongoServer = undefined;
        logger.info('MongoDB test server stopped');
      }
    } catch (error) {
      logger.error('Failed to stop MongoDB test server:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get MongoDB URI (if available)
   */
  get uri(): string | undefined {
    return this.mongoServer?.getUri() || process.env.TEST_MONGO_URI;
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    await this.clearCollections();
  }
}

// Export singleton instance
export const dbManager = new DbManager();

/**
 * Jest setup helper for beforeAll hook
 */
export const setupDatabase = async (): Promise<void> => {
  await dbManager.startDb();
};

/**
 * Jest teardown helper for afterAll hook  
 */
export const teardownDatabase = async (): Promise<void> => {
  await dbManager.stopDb();
};

/**
 * Jest cleanup helper for beforeEach/afterEach hooks
 */
export const cleanDatabase = async (): Promise<void> => {
  await dbManager.clearCollections();
};

/**
 * Connect to existing test database (for tests that need manual setup)
 */
export const connectTestDb = async (uri?: string): Promise<void> => {
  await dbManager.connectToTestDb(uri);
};

export default dbManager;