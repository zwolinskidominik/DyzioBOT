import { jest } from '@jest/globals';
import mongoose from 'mongoose';

// Mock database models for E2E testing
export class MockDatabase {
  private static models: Map<string, any> = new Map();
  private static connections: Map<string, boolean> = new Map();

  // Connection management
  public static async connect(): Promise<void> {
    this.connections.set('default', true);
  }

  public static async disconnect(): Promise<void> {
    this.connections.clear();
    this.models.clear();
  }

  public static isConnected(): boolean {
    return this.connections.has('default');
  }

  // Model registry
  public static registerModel(name: string, schema: any): any {
    const mockModel = this.createMockModel(name);
    this.models.set(name, mockModel);
    return mockModel;
  }

  public static getModel(name: string): any {
    return this.models.get(name);
  }

  // Mock model factory
  private static createMockModel(name: string) {
    return class MockModel {
      private data: any;
      private static documents: Map<string, any> = new Map();

      constructor(data: any = {}) {
        this.data = {
          _id: data._id || new mongoose.Types.ObjectId(),
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
      }

      // Instance methods
      async save(): Promise<any> {
        MockModel.documents.set(this.data._id.toString(), { ...this.data });
        return this;
      }

      async remove(): Promise<any> {
        MockModel.documents.delete(this.data._id.toString());
        return this;
      }

      async deleteOne(): Promise<any> {
        MockModel.documents.delete(this.data._id.toString());
        return { deletedCount: 1 };
      }

      toJSON(): any {
        return { ...this.data };
      }

      // Getter methods to access data properties
      get _id() { return this.data._id; }
      get userId() { return this.data.userId; }
      get guildId() { return this.data.guildId; }
      get level() { return this.data.level; }
      get xp() { return this.data.xp; }
      get totalXp() { return this.data.totalXp; }
      get prize() { return this.data.prize; }
      get active() { return this.data.active; }
      get participants() { return this.data.participants; }
      get winnerCount() { return this.data.winnerCount; }
      get endTime() { return this.data.endTime; }
      get hostId() { return this.data.hostId; }
      get channelId() { return this.data.channelId; }
      get messageId() { return this.data.messageId; }
      get roleIds() { return this.data.roleIds; }  // AutoRole field
      get greetingsChannelId() { return this.data.greetingsChannelId; }  // GreetingsConfiguration field
      get goodbyeChannelId() { return this.data.goodbyeChannelId; }  // GreetingsConfiguration field
      get parentChannelId() { return this.data.parentChannelId; }  // TempChannelConfiguration field
      get categoryId() { return this.data.categoryId; }  // TempChannelConfiguration field
      get ownerId() { return this.data.ownerId; }  // TempChannel field
      get parentId() { return this.data.parentId; }  // TempChannel field
      get enabled() { return this.data.enabled; }  // Configuration field

      // Setter methods for data modification
      set active(value: boolean) { this.data.active = value; }
      set endTime(value: Date) { this.data.endTime = value; }
      set xp(value: number) { this.data.xp = value; }
      set totalXp(value: number) { this.data.totalXp = value; }
      set level(value: number) { this.data.level = value; }

      // Static methods
      static async find(query: any = {}): Promise<any[]> {
        const docs = Array.from(MockModel.documents.values());
        return docs
          .filter(doc => this.matchesQuery(doc, query))
          .map(doc => new MockModel(doc));
      }

      static async findOne(query: any = {}): Promise<any | null> {
        const docs = await this.find(query);
        return docs[0] || null;
      }

      static async findById(id: string): Promise<any | null> {
        const doc = MockModel.documents.get(id.toString());
        return doc ? new MockModel(doc) : null;
      }

      static async findByIdAndUpdate(
        id: string, 
        update: any, 
        options: any = {}
      ): Promise<any | null> {
        const doc = MockModel.documents.get(id);
        if (!doc) return null;

        const updated = {
          ...doc,
          ...update,
          updatedAt: new Date(),
        };

        MockModel.documents.set(id, updated);
        return options.new ? new MockModel(updated) : new MockModel(doc);
      }

      static async findOneAndUpdate(
        query: any,
        update: any,
        options: any = {}
      ): Promise<any | null> {
        const docs = await this.find(query);
        if (docs.length === 0) return null;

        const doc = docs[0];
        const updated = {
          ...doc.data,
          ...update,
          updatedAt: new Date(),
        };

        MockModel.documents.set(doc.data._id.toString(), updated);
        return options.new ? new MockModel(updated) : doc;
      }

      static async findByIdAndDelete(id: string): Promise<any | null> {
        const doc = MockModel.documents.get(id);
        if (!doc) return null;

        MockModel.documents.delete(id);
        return new MockModel(doc);
      }

      static async findOneAndDelete(query: any): Promise<any | null> {
        const docs = await this.find(query);
        if (docs.length === 0) return null;

        const doc = docs[0];
        MockModel.documents.delete(doc.data._id.toString());
        return doc;
      }

      static async deleteOne(query: any): Promise<{ deletedCount: number }> {
        const docs = await this.find(query);
        if (docs.length === 0) return { deletedCount: 0 };

        MockModel.documents.delete(docs[0].data._id.toString());
        return { deletedCount: 1 };
      }

      static async deleteMany(query: any): Promise<{ deletedCount: number }> {
        const docs = await this.find(query);
        docs.forEach(doc => {
          MockModel.documents.delete(doc.data._id.toString());
        });
        return { deletedCount: docs.length };
      }

      static async create(data: any): Promise<any> {
        const doc = new MockModel(data);
        await doc.save();
        return doc;
      }

      static async insertMany(docs: any[]): Promise<any[]> {
        const results = [];
        for (const data of docs) {
          const doc = await this.create(data);
          results.push(doc);
        }
        return results;
      }

      static async countDocuments(query: any = {}): Promise<number> {
        const docs = await this.find(query);
        return docs.length;
      }

      static async aggregate(pipeline: any[]): Promise<any[]> {
        // Simplified aggregation - just return all documents for now
        const docs = Array.from(MockModel.documents.values());
        return docs.map(doc => new MockModel(doc));
      }

      static async distinct(field: string, query: any = {}): Promise<any[]> {
        const docs = await this.find(query);
        const values = docs.map(doc => doc.data[field]).filter(Boolean);
        return [...new Set(values)];
      }

      // Query building
      static where(field: string, condition?: any) {
        return {
          equals: (value: any) => this.find({ [field]: value }),
          in: (values: any[]) => this.find({ [field]: { $in: values } }),
          exists: (exists: boolean = true) => this.find({ [field]: { $exists: exists } }),
        };
      }

      // Clear all documents (for testing)
      static clearAll(): void {
        MockModel.documents.clear();
      }

      // Get all documents (for testing)
      static getAllDocuments(): any[] {
        return Array.from(MockModel.documents.values());
      }

      // Helper for query matching
      private static matchesQuery(doc: any, query: any): boolean {
        if (Object.keys(query).length === 0) return true;

        for (const [key, value] of Object.entries(query)) {
          if (key === '_id') {
            if (doc._id.toString() !== value?.toString()) return false;
          } else if (typeof value === 'object' && value !== null) {
            // Handle operators like $in, $exists, etc.
            if ('$in' in value) {
              if (!(value as any).$in.includes(doc[key])) return false;
            } else if ('$exists' in value) {
              const exists = doc[key] !== undefined && doc[key] !== null;
              if (exists !== (value as any).$exists) return false;
            } else if ('$ne' in value) {
              if (doc[key] === (value as any).$ne) return false;
            } else if ('$gt' in value) {
              if (!(doc[key] > (value as any).$gt)) return false;
            } else if ('$lt' in value) {
              if (!(doc[key] < (value as any).$lt)) return false;
            } else if ('$gte' in value) {
              if (!(doc[key] >= (value as any).$gte)) return false;
            } else if ('$lte' in value) {
              if (!(doc[key] <= (value as any).$lte)) return false;
            } else {
              // Nested object comparison
              if (JSON.stringify(doc[key]) !== JSON.stringify(value)) return false;
            }
          } else {
            if (doc[key] !== value) return false;
          }
        }

        return true;
      }
    };
  }
}

// Factory functions for creating test data
export class TestDataFactory {
  // User-related test data
  public static createTestUser(overrides: any = {}) {
    return {
      id: '123456789012345678',
      username: 'TestUser',
      discriminator: '1234',
      avatar: null,
      ...overrides,
    };
  }

  public static createTestGuild(overrides: any = {}) {
    return {
      id: '987654321012345678',
      name: 'Test Guild',
      ownerId: '123456789012345678',
      memberCount: 100,
      ...overrides,
    };
  }

  public static createTestChannel(overrides: any = {}) {
    return {
      id: '111222333444555666',
      name: 'test-channel',
      type: 0, // TEXT_CHANNEL
      guildId: '987654321012345678',
      ...overrides,
    };
  }

  // Bot-specific test data
  public static createTestLevel(overrides: any = {}) {
    return {
      userId: '123456789012345678',
      guildId: '987654321012345678',
      xp: 1000,
      level: 5,
      totalXp: 2500,
      lastMessageDate: new Date(),
      ...overrides,
    };
  }

  public static createTestBirthday(overrides: any = {}) {
    return {
      userId: '123456789012345678',
      guildId: '987654321012345678',
      birthMonth: 6,
      birthDay: 15,
      birthYear: 1995,
      timezone: 'Europe/Warsaw',
      ...overrides,
    };
  }

  public static createTestGiveaway(overrides: any = {}) {
    return {
      messageId: '777888999000111222',
      channelId: '111222333444555666',
      guildId: '987654321012345678',
      hostId: '123456789012345678',
      prize: 'Test Prize',
      description: 'Test giveaway description',
      winnerCount: 1,
      endTime: new Date(Date.now() + 3600000), // 1 hour from now
      requirements: [],
      participants: [],
      active: true,
      ...overrides,
    };
  }

  public static createTestSuggestion(overrides: any = {}) {
    return {
      userId: '123456789012345678',
      guildId: '987654321012345678',
      messageId: '777888999000111222',
      channelId: '111222333444555666',
      content: 'Test suggestion content',
      status: 'pending',
      upvotes: 0,
      downvotes: 0,
      voters: [],
      ...overrides,
    };
  }

  public static createTestWarn(overrides: any = {}) {
    return {
      userId: '123456789012345678',
      guildId: '987654321012345678',
      moderatorId: '999888777666555444',
      reason: 'Test warning reason',
      date: new Date(),
      active: true,
      ...overrides,
    };
  }

  public static createTestTicket(overrides: any = {}) {
    return {
      userId: '123456789012345678',
      guildId: '987654321012345678',
      channelId: '111222333444555666',
      type: 'support',
      status: 'open',
      createdAt: new Date(),
      subject: 'Test ticket subject',
      description: 'Test ticket description',
      participants: ['123456789012345678'],
      ...overrides,
    };
  }

  public static createTestAutoRole(overrides: any = {}) {
    return {
      guildId: '987654321012345678',
      roleId: '333444555666777888',
      enabled: true,
      ...overrides,
    };
  }

  public static createTestTempChannel(overrides: any = {}) {
    return {
      channelId: '111222333444555666',
      guildId: '987654321012345678',
      ownerId: '123456789012345678',
      parentId: '999888777666555444',
      createdAt: new Date(),
      lastActivity: new Date(),
      ...overrides,
    };
  }

  public static createTestStreamConfiguration(overrides: any = {}) {
    return {
      guildId: '987654321012345678',
      channelId: '111222333444555666',
      roleId: '333444555666777888',
      message: 'Test stream notification message',
      enabled: true,
      ...overrides,
    };
  }

  // Database operations helpers
  public static async seedDatabase(models: { [key: string]: any }, data: { [key: string]: any[] }) {
    for (const [modelName, documents] of Object.entries(data)) {
      const Model = models[modelName];
      if (Model) {
        for (const doc of documents) {
          await Model.create(doc);
        }
      }
    }
  }

  public static async clearDatabase(models: { [key: string]: any }) {
    for (const Model of Object.values(models)) {
      if (Model && Model.clearAll) {
        Model.clearAll();
      }
    }
  }
}

// Test database setup
export const setupTestDatabase = () => {
  let mockModels: { [key: string]: any } = {};

  beforeAll(async () => {
    await MockDatabase.connect();
    
    // Register all models used in the application
    mockModels = {
      Level: MockDatabase.registerModel('Level', {}),
      Birthday: MockDatabase.registerModel('Birthday', {}),
      BirthdayConfiguration: MockDatabase.registerModel('BirthdayConfiguration', {}),
      Giveaway: MockDatabase.registerModel('Giveaway', {}),
      Suggestion: MockDatabase.registerModel('Suggestion', {}),
      SuggestionConfiguration: MockDatabase.registerModel('SuggestionConfiguration', {}),
      Warn: MockDatabase.registerModel('Warn', {}),
      TicketState: MockDatabase.registerModel('TicketState', {}),
      TicketConfig: MockDatabase.registerModel('TicketConfig', {}),
      AutoRole: MockDatabase.registerModel('AutoRole', {}),
      TempChannel: MockDatabase.registerModel('TempChannel', {}),
      TempChannelConfiguration: MockDatabase.registerModel('TempChannelConfiguration', {}),
      StreamConfiguration: MockDatabase.registerModel('StreamConfiguration', {}),
      LevelConfig: MockDatabase.registerModel('LevelConfig', {}),
      GreetingsConfiguration: MockDatabase.registerModel('GreetingsConfiguration', {}),
      QuestionConfiguration: MockDatabase.registerModel('QuestionConfiguration', {}),
      Question: MockDatabase.registerModel('Question', {}),
      Fortune: MockDatabase.registerModel('Fortune', {}),
      ActivityBucket: MockDatabase.registerModel('ActivityBucket', {}),
      ChannelStats: MockDatabase.registerModel('ChannelStats', {}),
      TicketStats: MockDatabase.registerModel('TicketStats', {}),
      TwitchStreamer: MockDatabase.registerModel('TwitchStreamer', {}),
    };
  });

  beforeEach(async () => {
    // Clear all data before each test
    await TestDataFactory.clearDatabase(mockModels);
  });

  afterAll(async () => {
    await MockDatabase.disconnect();
  });

  return mockModels;
};