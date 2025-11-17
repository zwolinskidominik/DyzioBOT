import { BaseFactory, randomUUID } from './BaseFactory';
import { GiveawayModel, GiveawayDocument } from '../../../src/models/Giveaway';

export interface GiveawayFactoryData {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  winnersCount: number;
  endTime: Date;
  pingRoleId?: string;
  active: boolean;
  participants: string[];
  hostId: string;
  createdAt: Date;
  roleMultipliers: Map<string, number>;
  finalized: boolean;
}

export class GiveawayFactory extends BaseFactory<GiveawayDocument> {
  private static instance: GiveawayFactory;

  static getInstance(): GiveawayFactory {
    if (!GiveawayFactory.instance) {
      GiveawayFactory.instance = new GiveawayFactory();
    }
    return GiveawayFactory.instance;
  }

  build(overrides: Partial<GiveawayFactoryData> = {}): GiveawayDocument {
    const defaults: GiveawayFactoryData = {
      giveawayId: overrides.giveawayId || randomUUID(),
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      channelId: overrides.channelId || BaseFactory.pick(BaseFactory.SAMPLE_CHANNEL_IDS),
      messageId: overrides.messageId || BaseFactory.randomSnowflake(),
      prize: overrides.prize || this.generateRandomPrize(),
      description: overrides.description || this.generateRandomDescription(),
      winnersCount: overrides.winnersCount ?? Math.floor(Math.random() * 5) + 1,
      endTime: overrides.endTime || BaseFactory.futureDate(14),
      pingRoleId: overrides.pingRoleId || (Math.random() > 0.5 ? BaseFactory.pick(BaseFactory.SAMPLE_ROLE_IDS) : undefined),
      active: overrides.active ?? true,
      participants: overrides.participants || this.generateParticipants(),
      hostId: overrides.hostId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      createdAt: overrides.createdAt || BaseFactory.pastDate(1),
      roleMultipliers: overrides.roleMultipliers || this.generateRoleMultipliers(),
      finalized: overrides.finalized ?? false,
    };

    const data = { ...defaults, ...overrides };
    return new GiveawayModel(data) as GiveawayDocument;
  }

  async create(overrides: Partial<GiveawayFactoryData> = {}): Promise<GiveawayDocument> {
    const giveawayDoc = this.build(overrides);
    return await giveawayDoc.save();
  }

  async createActive(overrides: Partial<GiveawayFactoryData> = {}): Promise<GiveawayDocument> {
    return this.create({
      ...overrides,
      active: true,
      finalized: false,
      endTime: BaseFactory.futureDate(7),
    });
  }

  async createEnded(overrides: Partial<GiveawayFactoryData> = {}): Promise<GiveawayDocument> {
    return this.create({
      ...overrides,
      active: true,
      finalized: false,
      endTime: BaseFactory.pastDate(1),
    });
  }

  async createFinalized(overrides: Partial<GiveawayFactoryData> = {}): Promise<GiveawayDocument> {
    return this.create({
      ...overrides,
      active: false,
      finalized: true,
      endTime: BaseFactory.pastDate(3),
    });
  }

  async createPopular(participantCount = 50, overrides: Partial<GiveawayFactoryData> = {}): Promise<GiveawayDocument> {
    const participants = Array.from({ length: participantCount }, () => BaseFactory.randomSnowflake());
    return this.create({
      ...overrides,
      participants,
    });
  }

  async createForGuild(guildId: string, count = 3): Promise<GiveawayDocument[]> {
    return Promise.all(
      Array.from({ length: count }, () => this.create({ guildId }))
    );
  }

  async createSchedulerTestSet(guildId: string): Promise<{
    active: GiveawayDocument[];
    ended: GiveawayDocument[];
    finalized: GiveawayDocument[];
  }> {
    const [active, ended, finalized] = await Promise.all([
      Promise.all([
        this.createActive({ guildId }),
        this.createActive({ guildId }),
      ]),
      Promise.all([
        this.createEnded({ guildId }),
        this.createEnded({ guildId }),
      ]),
      Promise.all([
        this.createFinalized({ guildId }),
      ]),
    ]);

    return { active, ended, finalized };
  }

  private generateRandomPrize(): string {
    const prizes = [
      'Discord Nitro',
      'Steam Gift Card $50',
      'PlayStation Store $25',
      'Custom Discord Role',
      'Server Boost',
      'VIP Status',
      'Game Key Bundle',
      'Premium Bot Access',
      'Special Badge',
      'Monthly Subscription',
    ];
    return BaseFactory.pick(prizes);
  }

  private generateRandomDescription(): string {
    const descriptions = [
      'Join our amazing giveaway for a chance to win!',
      'React with 🎉 to participate in this awesome contest!',
      'Don\'t miss this incredible opportunity to win big!',
      'Limited time giveaway - enter now while you can!',
      'Special community event - good luck to everyone!',
      'Celebrating our server milestone with this giveaway!',
      'Thank you for being part of our community!',
      'Weekly giveaway is here - may the best win!',
    ];
    return BaseFactory.pick(descriptions);
  }

  private generateParticipants(): string[] {
    const count = Math.floor(Math.random() * 20) + 5;
    return Array.from({ length: count }, () => BaseFactory.randomSnowflake());
  }

  private generateRoleMultipliers(): Map<string, number> {
    const multipliers = new Map<string, number>();
    
    const roleCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < roleCount; i++) {
      const roleId = BaseFactory.pick(BaseFactory.SAMPLE_ROLE_IDS);
      const multiplier = Math.floor(Math.random() * 5) + 2;
      multipliers.set(roleId, multiplier);
    }
    
    return multipliers;
  }
}

export const giveawayFactory = GiveawayFactory.getInstance();