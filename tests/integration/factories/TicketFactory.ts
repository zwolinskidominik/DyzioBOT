import { BaseFactory } from './BaseFactory';
import { TicketConfigModel, TicketConfigDocument } from '../../../src/models/TicketConfig';
import { TicketStateModel, TicketStateDocument } from '../../../src/models/TicketState';
import { TicketStatsModel, TicketStatsDocument } from '../../../src/models/TicketStats';

export interface TicketConfigFactoryData {
  guildId: string;
  categoryId: string;
}

export interface TicketStateFactoryData {
  channelId: string;
  assignedTo?: string;
}

export interface TicketStatsFactoryData {
  guildId: string;
  userId: string;
  count: number;
}

export class TicketConfigFactory extends BaseFactory<TicketConfigDocument> {
  private static instance: TicketConfigFactory;

  static getInstance(): TicketConfigFactory {
    if (!TicketConfigFactory.instance) {
      TicketConfigFactory.instance = new TicketConfigFactory();
    }
    return TicketConfigFactory.instance;
  }

  build(overrides: Partial<TicketConfigFactoryData> = {}): TicketConfigDocument {
    const defaults: TicketConfigFactoryData = {
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      categoryId: overrides.categoryId || BaseFactory.randomSnowflake(),
    };

    const data = { ...defaults, ...overrides };
    return new TicketConfigModel(data) as TicketConfigDocument;
  }

  async create(overrides: Partial<TicketConfigFactoryData> = {}): Promise<TicketConfigDocument> {
    const doc = this.build(overrides);
    return await doc.save();
  }
}

export class TicketStateFactory extends BaseFactory<TicketStateDocument> {
  private static instance: TicketStateFactory;

  static getInstance(): TicketStateFactory {
    if (!TicketStateFactory.instance) {
      TicketStateFactory.instance = new TicketStateFactory();
    }
    return TicketStateFactory.instance;
  }

  build(overrides: Partial<TicketStateFactoryData> = {}): TicketStateDocument {
    const defaults: TicketStateFactoryData = {
      channelId: overrides.channelId || BaseFactory.randomSnowflake(),
      assignedTo: overrides.assignedTo || (Math.random() > 0.5 ? BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS) : undefined),
    };

    const data = { ...defaults, ...overrides };
    return new TicketStateModel(data) as TicketStateDocument;
  }

  async create(overrides: Partial<TicketStateFactoryData> = {}): Promise<TicketStateDocument> {
    const doc = this.build(overrides);
    return await doc.save();
  }

  /**
   * Create unassigned ticket
   */
  async createUnassigned(channelId?: string): Promise<TicketStateDocument> {
    return this.create({
      channelId: channelId || BaseFactory.randomSnowflake(),
      assignedTo: undefined,
    });
  }

  /**
   * Create assigned ticket
   */
  async createAssigned(assignedTo: string, channelId?: string): Promise<TicketStateDocument> {
    return this.create({
      channelId: channelId || BaseFactory.randomSnowflake(),
      assignedTo,
    });
  }

  /**
   * Create multiple ticket states for testing
   */
  async createTestSet(): Promise<{
    unassigned: TicketStateDocument[];
    assigned: TicketStateDocument[];
  }> {
    const [unassigned, assigned] = await Promise.all([
      Promise.all([
        this.createUnassigned(),
        this.createUnassigned(),
      ]),
      Promise.all([
        this.createAssigned(BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS)),
        this.createAssigned(BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS)),
      ]),
    ]);

    return { unassigned, assigned };
  }
}

export class TicketStatsFactory extends BaseFactory<TicketStatsDocument> {
  private static instance: TicketStatsFactory;

  static getInstance(): TicketStatsFactory {
    if (!TicketStatsFactory.instance) {
      TicketStatsFactory.instance = new TicketStatsFactory();
    }
    return TicketStatsFactory.instance;
  }

  build(overrides: Partial<TicketStatsFactoryData> = {}): TicketStatsDocument {
    const defaults: TicketStatsFactoryData = {
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      userId: overrides.userId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      count: overrides.count ?? Math.floor(Math.random() * 50) + 1, // 1-50 tickets handled
    };

    const data = { ...defaults, ...overrides };
    return new TicketStatsModel(data) as TicketStatsDocument;
  }

  async create(overrides: Partial<TicketStatsFactoryData> = {}): Promise<TicketStatsDocument> {
    const doc = this.build(overrides);
    return await doc.save();
  }

  /**
   * Create stats for new moderator (low count)
   */
  async createNewModerator(userId: string, guildId: string): Promise<TicketStatsDocument> {
    return this.create({
      userId,
      guildId,
      count: Math.floor(Math.random() * 5) + 1, // 1-5 tickets
    });
  }

  /**
   * Create stats for experienced moderator (high count)
   */
  async createExperiencedModerator(userId: string, guildId: string): Promise<TicketStatsDocument> {
    return this.create({
      userId,
      guildId,
      count: Math.floor(Math.random() * 100) + 50, // 50-149 tickets
    });
  }

  /**
   * Create moderator leaderboard
   */
  async createModeratorLeaderboard(guildId: string, moderatorCount = 5): Promise<TicketStatsDocument[]> {
    const moderators = BaseFactory.SAMPLE_USER_IDS.slice(0, moderatorCount);
    const counts = [120, 95, 78, 45, 23]; // Descending order

    return Promise.all(
      moderators.map((userId, index) => 
        this.create({
          userId,
          guildId,
          count: counts[index] || Math.floor(Math.random() * 20) + 1,
        })
      )
    );
  }

  /**
   * Create ticket system data set (config + states + stats)
   */
  async createTicketSystemSet(guildId: string): Promise<{
    config: TicketConfigDocument;
    states: { unassigned: TicketStateDocument[]; assigned: TicketStateDocument[] };
    stats: TicketStatsDocument[];
  }> {
    const configFactory = TicketConfigFactory.getInstance();
    const stateFactory = TicketStateFactory.getInstance();

    const [config, states, stats] = await Promise.all([
      configFactory.create({ guildId }),
      stateFactory.createTestSet(),
      this.createModeratorLeaderboard(guildId, 3),
    ]);

    return { config, states, stats };
  }
}

/**
 * Unified ticket factory for creating complete ticket ecosystem
 */
export class TicketFactory {
  private static instance: TicketFactory;

  static getInstance(): TicketFactory {
    if (!TicketFactory.instance) {
      TicketFactory.instance = new TicketFactory();
    }
    return TicketFactory.instance;
  }

  get config() {
    return TicketConfigFactory.getInstance();
  }

  get state() {
    return TicketStateFactory.getInstance();
  }

  get stats() {
    return TicketStatsFactory.getInstance();
  }

  /**
   * Create complete ticket system for guild
   */
  async createCompleteSystem(guildId: string) {
    return this.stats.createTicketSystemSet(guildId);
  }

  /**
   * Create ticket workflow scenario
   */
  async createWorkflowScenario(guildId: string) {
    const moderator = ticketStatsFactory.build().userId; // Get user from factory
    const channelId = ticketStateFactory.build().channelId; // Get channel from factory

    const [config, initialState, stats] = await Promise.all([
      this.config.create({ guildId }),
      this.state.createUnassigned(channelId),
      this.stats.createNewModerator(moderator, guildId),
    ]);

    // Create a copy of initial state for unassigned reference
    const unassignedState = {
      ...initialState.toObject(),
      assignedTo: undefined,
    };

    // Simulate assignment by updating the existing state
    initialState.assignedTo = moderator;
    const assignedState = await initialState.save();

    return {
      config,
      unassignedState,
      assignedState,
      stats,
      moderator,
      channelId,
    };
  }
}

// Export singleton instances
export const ticketConfigFactory = TicketConfigFactory.getInstance();
export const ticketStateFactory = TicketStateFactory.getInstance();
export const ticketStatsFactory = TicketStatsFactory.getInstance();
export const ticketFactory = TicketFactory.getInstance();