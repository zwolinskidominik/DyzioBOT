import { 
  levelFactory, 
  giveawayFactory, 
  warnFactory, 
  ticketFactory,
  userFactory,
  guildFactory 
} from '../factories';
import { setupDatabase, teardownDatabase, cleanDatabase } from '../setup/db';

/**
 * Example test demonstrating factory usage
 */
describe('Factory Integration Examples', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('LevelFactory', () => {
    it('should create level with realistic data', async () => {
      const level = await levelFactory.create();
      
      expect(level.guildId).toBeDefined();
      expect(level.userId).toBeDefined();
      expect(level.xp).toBeGreaterThanOrEqual(0);
      expect(level.level).toBeGreaterThanOrEqual(1);
    });

    it('should create leaderboard data', async () => {
      const guildId = '123456789012345678';
      const leaderboard = await levelFactory.createLeaderboard(guildId, 5);
      
      expect(leaderboard).toHaveLength(5);
      expect(leaderboard[0].level).toBeGreaterThanOrEqual(leaderboard[4].level);
      leaderboard.forEach(level => {
        expect(level.guildId).toBe(guildId);
      });
    });
  });

  describe('GiveawayFactory', () => {
    it('should create active giveaway', async () => {
      const giveaway = await giveawayFactory.createActive();
      
      expect(giveaway.active).toBe(true);
      expect(giveaway.finalized).toBe(false);
      expect(giveaway.endTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create popular giveaway with many participants', async () => {
      const giveaway = await giveawayFactory.createPopular(100);
      
      expect(giveaway.participants).toHaveLength(100);
      expect(giveaway.participants).toEqual(expect.arrayContaining([
        expect.stringMatching(/^\d+$/) // Snowflake pattern
      ]));
    });
  });

  describe('WarnFactory', () => {
    it('should create progressive warnings', async () => {
      const userId = '123456789012345678';
      const guildId = '234567890123456789';
      
      const warns = await warnFactory.createProgressiveWarns(userId, guildId, 3);
      
      expect(warns.warnings).toHaveLength(3);
      
      // Sort warnings by date to check they span over time
      const sortedDates = warns.warnings
        .map(w => w.date.getTime())
        .sort((a, b) => a - b);
      
      // Ensure earliest and latest dates have meaningful difference (at least 1 day)
      const dayInMs = 24 * 60 * 60 * 1000;
      expect(sortedDates[sortedDates.length - 1] - sortedDates[0]).toBeGreaterThan(dayInMs);
    });

    it('should add warning to existing user', async () => {
      const userId = '123456789012345678';
      const guildId = '234567890123456789';
      
      await warnFactory.createSingleWarn(userId, guildId);
      const updated = await warnFactory.addWarnToUser(userId, guildId, 'Second warning');
      
      expect(updated.warnings).toHaveLength(2);
      expect(updated.warnings[1].reason).toBe('Second warning');
    });
  });

  describe('TicketFactory', () => {
    it('should create complete ticket system', async () => {
      const guildId = '123456789012345678';
      const system = await ticketFactory.createCompleteSystem(guildId);
      
      expect(system.config.guildId).toBe(guildId);
      expect(system.states.unassigned).toHaveLength(2);
      expect(system.states.assigned).toHaveLength(2);
      expect(system.stats).toHaveLength(3);
    });

    it('should create workflow scenario', async () => {
      const guildId = '123456789012345678';
      const workflow = await ticketFactory.createWorkflowScenario(guildId);
      
      expect(workflow.config.guildId).toBe(guildId);
      expect(workflow.unassignedState.assignedTo).toBeUndefined();
      expect(workflow.assignedState.assignedTo).toBe(workflow.moderator);
    });
  });

  describe('Discord Factories (Mock Data)', () => {
    it('should create user data', () => {
      const user = userFactory.build();
      
      expect(user.id).toMatch(/^\d+$/);
      expect(user.username).toBeDefined();
      expect(user.bot).toBe(false);
    });

    it('should create bot user', () => {
      const bot = userFactory.createBot();
      
      expect(bot.bot).toBe(true);
      expect(bot.verified).toBe(true);
    });

    it('should create guild data', () => {
      const guild = guildFactory.build();
      
      expect(guild.id).toBeDefined();
      expect(guild.name).toBeDefined();
      expect(guild.ownerId).toBeDefined();
      expect(guild.roles).toBeInstanceOf(Array);
    });

    it('should create main server guild', () => {
      const mainGuild = guildFactory.createMainServer();
      
      expect(mainGuild.id).toBe('881293681783623680');
      expect(mainGuild.name).toBe('GameZone');
      expect(mainGuild.features).toContain('COMMUNITY');
    });
  });

  describe('Factory Combinations', () => {
    it('should create complex test scenario', async () => {
      const guildId = '123456789012345678';
      const userId = '234567890123456789';
      
      // Create user data
      const user = userFactory.build({ id: userId });
      const guild = guildFactory.build({ id: guildId });
      
      // Create database records
      const [level, giveaways, warns, ticketStats] = await Promise.all([
        levelFactory.create({ userId, guildId }),
        giveawayFactory.createForGuild(guildId, 2),
        warnFactory.createSingleWarn(userId, guildId),
        ticketFactory.stats.createNewModerator(userId, guildId),
      ]);
      
      expect(level.userId).toBe(userId);
      expect(giveaways).toHaveLength(2);
      expect(warns.warnings).toHaveLength(1);
      expect(ticketStats.userId).toBe(userId);
      
      // Verify user and guild mock data
      expect(user.id).toBe(userId);
      expect(guild.id).toBe(guildId);
    });
  });
});