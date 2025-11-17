import { 
  levelFactory,
  giveawayFactory,
  warnFactory,
  ticketConfigFactory,
  ticketStateFactory,
  ticketStatsFactory,
  userFactory,
  guildFactory,
  type LevelFactoryData,
  type GiveawayFactoryData,
  type WarnFactoryData,
  type UserFactoryData,
  type GuildFactoryData
} from '../factories';
import { DbManager } from '../setup/db';
import logger from '../../../src/utils/logger';

import { LevelModel } from '../../../src/models/Level';
import { GiveawayModel } from '../../../src/models/Giveaway';
import { WarnModel } from '../../../src/models/Warn';
import { AutoRoleModel } from '../../../src/models/AutoRole';
import { BirthdayModel } from '../../../src/models/Birthday';
import { BirthdayConfigurationModel } from '../../../src/models/BirthdayConfiguration';
import { ChannelStatsModel } from '../../../src/models/ChannelStats';
import { FortuneModel } from '../../../src/models/Fortune';
import { GreetingsConfigurationModel } from '../../../src/models/GreetingsConfiguration';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { QuestionModel } from '../../../src/models/Question';
import { QuestionConfigurationModel } from '../../../src/models/QuestionConfiguration';
import { StreamConfigurationModel } from '../../../src/models/StreamConfiguration';
import { SuggestionModel } from '../../../src/models/Suggestion';
import { SuggestionConfigurationModel } from '../../../src/models/SuggestionConfiguration';
import { TempChannelModel } from '../../../src/models/TempChannel';
import { TempChannelConfigurationModel } from '../../../src/models/TempChannelConfiguration';
import { TicketConfigModel } from '../../../src/models/TicketConfig';
import { TicketStateModel } from '../../../src/models/TicketState';
import { TicketStatsModel } from '../../../src/models/TicketStats';
import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';
import { ActivityBucketModel } from '../../../src/models/ActivityBucket';

export interface SeedGuildOptions {
  id?: string;
  name?: string;
  ownerId?: string;
  memberCount?: number;
  features?: string[];
  createConfigurations?: boolean;
  includeChannels?: boolean;
  includeRoles?: boolean;
}

export interface SeedUsersOptions {
  count?: number;
  guildId?: string;
  includeMembers?: boolean;
  userOverrides?: Partial<UserFactoryData>[];
}

export interface SeedLevelsOptions {
  guildId: string;
  userCount?: number;
  userIds?: string[];
  levelRange?: [number, number];
  includeConfig?: boolean;
}

export interface TestEnvironmentOptions {
  guildName?: string;
  userCount?: number;
  levelSystem?: boolean;
  giveaways?: number;
  warnings?: number;
  tickets?: boolean;
  autoRole?: boolean;
  birthdays?: boolean;
  suggestions?: boolean;
  questions?: boolean;
  twitchStreamers?: number;
}

export interface TestEnvironment {
  guild: any;
  users: any[];
  levels?: any[];
  giveaways?: any[];
  warnings?: any[];
  configurations?: {
    levelConfig?: any;
    birthdayConfig?: any;
    suggestionConfig?: any;
    questionConfig?: any;
    greetingsConfig?: any;
    streamConfig?: any;
    tempChannelConfig?: any;
  };
  tickets?: {
    config?: any;
    states?: any[];
    stats?: any[];
  };
}

export class SeedingUtility {
  private dbManager: DbManager;

  constructor(dbManager?: DbManager) {
    this.dbManager = dbManager || new DbManager();
  }

  async seedGuild(options: SeedGuildOptions = {}): Promise<any> {
    const guildData = guildFactory.build({
      id: options.id,
      name: options.name,
      ownerId: options.ownerId,
      memberCount: options.memberCount,
      features: options.features || [],
      ...options
    });

    if (!guildData.id) {
      guildData.id = `guild-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    logger.info(`Seeding guild: ${guildData.name} (${guildData.id})`);

    if (options.createConfigurations) {
      await this.createGuildConfigurations(guildData.id);
    }

    return guildData;
  }

  async seedUsers(options: SeedUsersOptions = {}): Promise<any[]> {
    const { count = 10, guildId, includeMembers = false, userOverrides = [] } = options;
    const users: any[] = [];
    
    logger.info(`Seeding ${count} users${guildId ? ` for guild ${guildId}` : ''}`);

    for (let i = 0; i < count; i++) {
      const override: Partial<UserFactoryData> = userOverrides[i] || {};
      const userData = userFactory.build({
        username: `testuser${i + 1}`,
        discriminator: String(i + 1).padStart(4, '0'),
        ...override
      });

      users.push(userData);

      if (includeMembers && guildId) {
        (userData as any).guildId = guildId;
        (userData as any).joinedAt = new Date();
        (userData as any).roles = ['@everyone'];
      }
    }

    return users;
  }

  async seedLevels(options: SeedLevelsOptions): Promise<any[]> {
    const { 
      guildId, 
      userCount = 10, 
      userIds, 
      levelRange = [1, 50],
      includeConfig = true 
    } = options;

    logger.info(`Seeding level system for guild ${guildId}`);

    const levels: any[] = [];
    const targetUserIds = userIds || (await this.seedUsers({ count: userCount })).map(u => u.id);

    if (includeConfig) {
      const levelConfig = {
        guildId,
        enabled: true,
        levelUpChannel: null,
        levelUpMessage: 'Gratulacje {user}! Osiągnąłeś poziom {level}!',
        multiplier: 1.0,
        roles: [],
        ignoredChannels: [],
        ignoredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await LevelConfigModel.create(levelConfig);
      logger.info(`Created level config for guild ${guildId}`);
    }

    for (const userId of targetUserIds) {
      const level: number = Math.floor(Math.random() * (levelRange[1] - levelRange[0] + 1)) + levelRange[0];
      const xp: number = Math.floor(Math.random() * 1000) + (level * 100);

      const levelData = levelFactory.build({
        guildId,
        userId,
        level,
        xp,
      });

      const createdLevel = await LevelModel.create(levelData);
      levels.push(createdLevel);
    }

    logger.info(`Created ${levels.length} level records`);
    return levels;
  }

  async seedGiveaways(guildId: string, count: number = 3): Promise<any[]> {
    logger.info(`Seeding ${count} giveaways for guild ${guildId}`);

    const giveaways: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const giveawayData = giveawayFactory.build({
        guildId,
        prize: `Test Giveaway ${i + 1}`,
        description: `This is test giveaway number ${i + 1}`,
        channelId: `channel-${i + 1}`,
        messageId: `message-${i + 1}`,
        endTime: new Date(Date.now() + (24 * 60 * 60 * 1000)),
        active: i < 2,
        winnersCount: Math.floor(Math.random() * 3) + 1,
      });

      const createdGiveaway = await GiveawayModel.create(giveawayData);
      giveaways.push(createdGiveaway);
    }

    return giveaways;
  }

  async seedWarnings(guildId: string, userIds: string[], warningsPerUser: number = 2): Promise<any[]> {
    logger.info(`Seeding warnings for ${userIds.length} users in guild ${guildId}`);

    const createdWarnings: any[] = [];

    for (const userId of userIds) {
      const userWarnings = [];
      for (let i = 0; i < warningsPerUser; i++) {
        userWarnings.push({
          reason: `Test warning ${i + 1} for user`,
          date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
          moderatorId: 'moderator-123',
        });
      }

      const warnData = warnFactory.build({
        guildId,
        userId,
        warnings: userWarnings,
      });

      const createdWarn = await WarnModel.create(warnData);
      createdWarnings.push(createdWarn);
    }

    return createdWarnings;
  }

  async seedTicketSystem(guildId: string): Promise<{ config: any; states: any[]; stats: any[] }> {
    logger.info(`Seeding ticket system for guild ${guildId}`);

    const ticketConfig = ticketConfigFactory.build({
      guildId,
      categoryId: 'category-123',
    });

    const createdConfig = await TicketConfigModel.create(ticketConfig);

    const states: any[] = [];
    for (let i = 0; i < 5; i++) {
      const stateData = ticketStateFactory.build({
        channelId: `ticket-channel-${i + 1}`,
        assignedTo: i < 3 ? `moderator-${i + 1}` : undefined,
      });

      const createdState = await TicketStateModel.create(stateData);
      states.push(createdState);
    }

    const stats: any[] = [];
    const statsData = ticketStatsFactory.build({
      guildId,
      userId: 'admin-user-123',
      count: states.length,
    });

    const createdStats = await TicketStatsModel.create(statsData);
    stats.push(createdStats);

    return { config: createdConfig, states, stats };
  }

  private async createGuildConfigurations(guildId: string): Promise<void> {
    logger.info(`Creating configurations for guild ${guildId}`);

    await BirthdayConfigurationModel.create({
      guildId,
      birthdayChannelId: 'birthday-channel-123'
    });

    await GreetingsConfigurationModel.create({
      guildId,
      greetingsChannelId: 'greetings-channel-123'
    });

    await SuggestionConfigurationModel.create({
      guildId,
      suggestionChannelId: 'suggestions-channel-123'
    });

    await QuestionConfigurationModel.create({
      guildId,
      questionChannelId: 'questions-channel-123'
    });

    await StreamConfigurationModel.create({
      guildId,
      channelId: '1234567890123456789'
    });

    await TempChannelConfigurationModel.create({
      guildId,
      channelId: 'temp-channel-123'
    });

    logger.info(`Created all configurations for guild ${guildId}`);
  }

  async clearTestData(): Promise<void> {
    logger.info('Clearing all test data from database');

    const collections = [
      ActivityBucketModel,
      AutoRoleModel,
      BirthdayModel,
      BirthdayConfigurationModel,
      ChannelStatsModel,
      FortuneModel,
      GiveawayModel,
      GreetingsConfigurationModel,
      LevelModel,
      LevelConfigModel,
      QuestionModel,
      QuestionConfigurationModel,
      StreamConfigurationModel,
      SuggestionModel,
      SuggestionConfigurationModel,
      TempChannelModel,
      TempChannelConfigurationModel,
      TicketConfigModel,
      TicketStateModel,
      TicketStatsModel,
      TwitchStreamerModel,
      WarnModel
    ];

    for (const Model of collections) {
      try {
        await (Model as any).deleteMany({});
        (logger as any).debug?.(`Cleared ${(Model as any).modelName} collection`);
      } catch (error) {
        logger.warn(`Failed to clear ${(Model as any).modelName}: ${error}`);
      }
    }

    logger.info('Test data cleared successfully');
  }

  async createTestEnvironment(options: TestEnvironmentOptions = {}): Promise<TestEnvironment> {
    const {
      guildName = 'Test Guild',
      userCount = 20,
      levelSystem = true,
      giveaways = 3,
      warnings = 5,
      tickets = true,
      autoRole = true,
      birthdays = true,
      suggestions = true,
      questions = true,
      twitchStreamers = 2
    } = options;

    logger.info('Creating comprehensive test environment');

    await this.clearTestData();

    const guild = await this.seedGuild({
      name: guildName,
      createConfigurations: true,
      includeChannels: true,
      includeRoles: true
    });

    const users = await this.seedUsers({
      count: userCount,
      guildId: guild.id,
      includeMembers: true
    });

    const environment: TestEnvironment = {
      guild,
      users,
      configurations: {}
    };

    if (levelSystem) {
      environment.levels = await this.seedLevels({
        guildId: guild.id,
        userIds: users.slice(0, 15).map(u => u.id),
        includeConfig: true
      });
    }

    if (giveaways > 0) {
      environment.giveaways = await this.seedGiveaways(guild.id, giveaways);
    }

    if (warnings > 0) {
      const usersToWarn = users.slice(0, Math.min(warnings, users.length));
      environment.warnings = await this.seedWarnings(
        guild.id, 
        usersToWarn.map(u => u.id),
        2
      );
    }

    if (tickets) {
      environment.tickets = await this.seedTicketSystem(guild.id);
    }

    if (birthdays) {
      const birthdayUsers = users.slice(0, 5);
      for (const user of birthdayUsers) {
        await BirthdayModel.create({
          guildId: guild.id,
          userId: user.id,
          date: new Date(2000, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
        });
      }
    }

    if (autoRole) {
      await AutoRoleModel.create({
        guildId: guild.id,
        roleId: 'auto-role-123',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (suggestions) {
      for (let i = 0; i < 3; i++) {
        await SuggestionModel.create({
          guildId: guild.id,
          authorId: users[i].id,
          messageId: `suggestion-message-${i + 1}`,
          content: `Test suggestion ${i + 1}`
        });
      }
    }

    if (questions) {
      for (let i = 0; i < 3; i++) {
        await QuestionModel.create({
          guildId: guild.id,
          authorId: users[i].id,
          messageId: `question-message-${i + 1}`,
          content: `Test question ${i + 1}?`
        });
      }
    }

    if (twitchStreamers > 0) {
      for (let i = 0; i < twitchStreamers; i++) {
        await TwitchStreamerModel.create({
          guildId: guild.id,
          userId: users[i].id,
          twitchChannel: `streamer${i + 1}`
        });
      }
    }

    logger.info(`Test environment created successfully for guild ${guild.name}`);
    logger.info(`- ${users.length} users`);
    logger.info(`- ${environment.levels?.length || 0} level records`);
    logger.info(`- ${environment.giveaways?.length || 0} giveaways`);
    logger.info(`- ${environment.warnings?.length || 0} warnings`);
    logger.info(`- Ticket system: ${tickets ? 'enabled' : 'disabled'}`);

    return environment;
  }
}

export const seedingUtility = new SeedingUtility();

export const seedGuild = (options?: SeedGuildOptions) => seedingUtility.seedGuild(options);
export const seedUsers = (options?: SeedUsersOptions) => seedingUtility.seedUsers(options);
export const seedLevels = (options: SeedLevelsOptions) => seedingUtility.seedLevels(options);
export const clearTestData = () => seedingUtility.clearTestData();
export const createTestEnvironment = (options?: TestEnvironmentOptions) => seedingUtility.createTestEnvironment(options);

export default seedingUtility;
