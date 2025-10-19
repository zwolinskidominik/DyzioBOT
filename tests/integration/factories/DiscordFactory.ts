import { BaseFactory } from './BaseFactory';

/**
 * Mock user data for Discord users
 */
export interface UserFactoryData {
  id: string;
  username: string;
  discriminator: string;
  globalName?: string;
  avatar?: string;
  bot: boolean;
  system: boolean;
  mfaEnabled: boolean;
  verified?: boolean;
  email?: string;
  flags?: number;
  premiumType?: number;
  publicFlags?: number;
}

/**
 * Mock guild data for Discord guilds
 */
export interface GuildFactoryData {
  id: string;
  name: string;
  icon?: string;
  iconHash?: string;
  splash?: string;
  discoverySplash?: string;
  owner?: boolean;
  ownerId: string;
  permissions?: string;
  region?: string;
  afkChannelId?: string;
  afkTimeout: number;
  widgetEnabled?: boolean;
  widgetChannelId?: string;
  verificationLevel: number;
  defaultMessageNotifications: number;
  explicitContentFilter: number;
  roles: string[];
  emojis: string[];
  features: string[];
  mfaLevel: number;
  applicationId?: string;
  systemChannelId?: string;
  systemChannelFlags: number;
  rulesChannelId?: string;
  maxPresences?: number;
  maxMembers?: number;
  vanityUrlCode?: string;
  description?: string;
  banner?: string;
  premiumTier: number;
  premiumSubscriptionCount?: number;
  preferredLocale: string;
  publicUpdatesChannelId?: string;
  maxVideoChannelUsers?: number;
  approximateMemberCount?: number;
  approximatePresenceCount?: number;
  welcomeScreen?: any;
  nsfwLevel: number;
  premiumProgressBarEnabled: boolean;
}

export class UserFactory extends BaseFactory<UserFactoryData> {
  private static instance: UserFactory;

  static getInstance(): UserFactory {
    if (!UserFactory.instance) {
      UserFactory.instance = new UserFactory();
    }
    return UserFactory.instance;
  }

  build(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
    const username = overrides.username || BaseFactory.randomString('testuser', 6);
    
    const defaults: UserFactoryData = {
      id: overrides.id || BaseFactory.randomSnowflake(),
      username,
      discriminator: overrides.discriminator || '0000', // New username system
      globalName: overrides.globalName || username,
      avatar: overrides.avatar || undefined,
      bot: overrides.bot ?? false,
      system: overrides.system ?? false,
      mfaEnabled: overrides.mfaEnabled ?? true,
      verified: overrides.verified ?? true,
      email: overrides.email || `${username}@example.com`,
      flags: overrides.flags ?? 0,
      premiumType: overrides.premiumType ?? 0,
      publicFlags: overrides.publicFlags ?? 0,
    };

    return { ...defaults, ...overrides };
  }

  async create(overrides: Partial<UserFactoryData> = {}): Promise<UserFactoryData> {
    // For Discord mocks, we don't save to database, just return the data
    return this.build(overrides);
  }

  /**
   * Create bot user
   */
  createBot(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
    return this.build({
      ...overrides,
      bot: true,
      username: overrides.username || 'TestBot',
      verified: true,
    });
  }

  /**
   * Create admin user
   */
  createAdmin(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
    return this.build({
      ...overrides,
      username: overrides.username || 'admin',
      mfaEnabled: true,
      verified: true,
    });
  }

  /**
   * Create premium user
   */
  createPremium(overrides: Partial<UserFactoryData> = {}): UserFactoryData {
    return this.build({
      ...overrides,
      premiumType: 2, // Nitro
      flags: 64, // Premium Early Supporter
    });
  }
}

export class GuildFactory extends BaseFactory<GuildFactoryData> {
  private static instance: GuildFactory;

  static getInstance(): GuildFactory {
    if (!GuildFactory.instance) {
      GuildFactory.instance = new GuildFactory();
    }
    return GuildFactory.instance;
  }

  build(overrides: Partial<GuildFactoryData> = {}): GuildFactoryData {
    const defaults: GuildFactoryData = {
      id: overrides.id || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      name: overrides.name || BaseFactory.randomString('Test Guild', 4),
      ownerId: overrides.ownerId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      afkTimeout: overrides.afkTimeout ?? 300,
      verificationLevel: overrides.verificationLevel ?? 1,
      defaultMessageNotifications: overrides.defaultMessageNotifications ?? 0,
      explicitContentFilter: overrides.explicitContentFilter ?? 1,
      roles: overrides.roles || BaseFactory.SAMPLE_ROLE_IDS.slice(0, 3),
      emojis: overrides.emojis || [],
      features: overrides.features || ['COMMUNITY'],
      mfaLevel: overrides.mfaLevel ?? 0,
      systemChannelFlags: overrides.systemChannelFlags ?? 0,
      premiumTier: overrides.premiumTier ?? 0,
      preferredLocale: overrides.preferredLocale || 'en-US',
      nsfwLevel: overrides.nsfwLevel ?? 0,
      premiumProgressBarEnabled: overrides.premiumProgressBarEnabled ?? false,
    };

    return { ...defaults, ...overrides };
  }

  async create(overrides: Partial<GuildFactoryData> = {}): Promise<GuildFactoryData> {
    // For Discord mocks, we don't save to database, just return the data
    return this.build(overrides);
  }

  /**
   * Create test server guild
   */
  createTestServer(overrides: Partial<GuildFactoryData> = {}): GuildFactoryData {
    return this.build({
      ...overrides,
      id: '1264582308003053570', // Known test server ID
      name: 'Test Server',
      features: ['COMMUNITY', 'NEWS'],
      verificationLevel: 2,
    });
  }

  /**
   * Create main server guild
   */
  createMainServer(overrides: Partial<GuildFactoryData> = {}): GuildFactoryData {
    return this.build({
      ...overrides,
      id: '881293681783623680', // Known main server ID
      name: 'GameZone',
      premiumTier: 2,
      features: ['COMMUNITY', 'NEWS', 'WELCOME_SCREEN_ENABLED'],
      verificationLevel: 3,
    });
  }

  /**
   * Create premium guild with boosts
   */
  createPremiumGuild(overrides: Partial<GuildFactoryData> = {}): GuildFactoryData {
    return this.build({
      ...overrides,
      premiumTier: 3,
      premiumSubscriptionCount: 15,
      features: ['COMMUNITY', 'NEWS', 'BANNER', 'VANITY_URL'],
      banner: 'test_banner_hash',
      vanityUrlCode: 'testguild',
    });
  }

  /**
   * Create guild with channels and roles setup
   */
  createWithChannelsAndRoles(overrides: Partial<GuildFactoryData> = {}): GuildFactoryData {
    return this.build({
      ...overrides,
      systemChannelId: BaseFactory.pick(BaseFactory.SAMPLE_CHANNEL_IDS),
      rulesChannelId: BaseFactory.pick(BaseFactory.SAMPLE_CHANNEL_IDS),
      publicUpdatesChannelId: BaseFactory.pick(BaseFactory.SAMPLE_CHANNEL_IDS),
      afkChannelId: BaseFactory.pick(BaseFactory.SAMPLE_CHANNEL_IDS),
      roles: BaseFactory.SAMPLE_ROLE_IDS,
    });
  }
}

// Export singleton instances
export const userFactory = UserFactory.getInstance();
export const guildFactory = GuildFactory.getInstance();