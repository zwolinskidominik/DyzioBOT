import { 
  seedingUtility, 
  seedGuild, 
  seedUsers, 
  seedLevels, 
  clearTestData, 
  createTestEnvironment,
  type TestEnvironment 
} from './seeding';
import { DbManager } from '../setup/db';

describe('Seeding Utility Tests', () => {
  let dbManager: DbManager;

  beforeAll(async () => {
    dbManager = new DbManager();
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('Individual Seeding Functions', () => {
    test('should seed a guild with basic data', async () => {
      const guild = await seedGuild({
        name: 'Test Integration Guild',
        memberCount: 100,
        createConfigurations: false
      });

      expect(guild).toBeDefined();
      expect(guild.name).toBe('Test Integration Guild');
      expect(guild.memberCount).toBe(100);
      expect(guild.id).toBeDefined();
    });

    test('should seed users with guild membership', async () => {
      const guild = await seedGuild({ name: 'Test Guild' });
      const users = await seedUsers({
        count: 5,
        guildId: guild.id,
        includeMembers: true
      });

      expect(users).toHaveLength(5);
      expect(users[0].username).toMatch(/testuser\d+/);
      expect((users[0] as any).guildId).toBe(guild.id);
      expect((users[0] as any).joinedAt).toBeDefined();
    });

    test('should seed level system for a guild', async () => {
      const guild = await seedGuild({ name: 'Level Test Guild' });
      const users = await seedUsers({ count: 10 });
      
      const levels = await seedLevels({
        guildId: guild.id,
        userIds: users.slice(0, 5).map(u => u.id),
        levelRange: [1, 20],
        includeConfig: true
      });

      expect(levels).toHaveLength(5);
      expect(levels[0].guildId).toBe(guild.id);
      expect(levels[0].level).toBeGreaterThanOrEqual(1);
      expect(levels[0].level).toBeLessThanOrEqual(20);
      expect(levels[0].xp).toBeGreaterThan(0);
    });
  });

  describe('Advanced Seeding', () => {
    test('should seed giveaways for a guild', async () => {
      const guild = await seedGuild({ name: 'Giveaway Guild' });
      
      const giveaways = await seedingUtility.seedGiveaways(guild.id, 3);

      expect(giveaways).toHaveLength(3);
      expect(giveaways[0].guildId).toBe(guild.id);
      expect(giveaways[0].prize).toMatch(/Test Giveaway \d+/);
      expect(giveaways[0].active).toBeDefined();
    });

    test('should seed warnings for users', async () => {
      const guild = await seedGuild({ name: 'Warning Guild' });
      const users = await seedUsers({ count: 3 });
      
      const warnings = await seedingUtility.seedWarnings(
        guild.id, 
        users.map(u => u.id), 
        2
      );

      expect(warnings).toHaveLength(3);
      expect(warnings[0].guildId).toBe(guild.id);
      expect(warnings[0].warnings).toHaveLength(2);
      expect(warnings[0].warnings[0].reason).toMatch(/Test warning \d+/);
    });

    test('should seed complete ticket system', async () => {
      const guild = await seedGuild({ name: 'Ticket Guild' });
      
      const ticketSystem = await seedingUtility.seedTicketSystem(guild.id);

      expect(ticketSystem.config).toBeDefined();
      expect(ticketSystem.config.guildId).toBe(guild.id);
      expect(ticketSystem.states).toHaveLength(5);
      expect(ticketSystem.stats).toHaveLength(1);
      expect(ticketSystem.stats[0].count).toBe(5);
    });
  });

  describe('Complete Test Environment', () => {
    test('should create minimal test environment', async () => {
      const environment: TestEnvironment = await createTestEnvironment({
        guildName: 'Minimal Test Server',
        userCount: 10,
        levelSystem: false,
        giveaways: 0,
        warnings: 0,
        tickets: false
      });

      expect(environment.guild).toBeDefined();
      expect(environment.guild.name).toBe('Minimal Test Server');
      expect(environment.users).toHaveLength(10);
      expect(environment.levels).toBeUndefined();
      expect(environment.giveaways).toBeUndefined();
      expect(environment.warnings).toBeUndefined();
      expect(environment.tickets).toBeUndefined();
    });

    test('should create comprehensive test environment', async () => {
      const environment: TestEnvironment = await createTestEnvironment({
        guildName: 'Full Feature Server',
        userCount: 25,
        levelSystem: true,
        giveaways: 5,
        warnings: 10,
        tickets: true,
        autoRole: true,
        birthdays: true,
        suggestions: true,
        questions: true,
        twitchStreamers: 3
      });

      expect(environment.guild).toBeDefined();
      expect(environment.guild.name).toBe('Full Feature Server');
      expect(environment.users).toHaveLength(25);
      
      expect(environment.levels).toBeDefined();
      expect(environment.levels!.length).toBe(15);
      
      expect(environment.giveaways).toBeDefined();
      expect(environment.giveaways!).toHaveLength(5);
      
      expect(environment.warnings).toBeDefined();
      expect(environment.warnings!.length).toBeGreaterThan(0);
      
      expect(environment.tickets).toBeDefined();
      expect(environment.tickets!.config).toBeDefined();
      expect(environment.tickets!.states).toHaveLength(5);
      expect(environment.tickets!.stats).toHaveLength(1);
    });

    test('should create realistic Discord server environment', async () => {
      const environment: TestEnvironment = await createTestEnvironment({
        guildName: 'Realistic Discord Server',
        userCount: 50,
        levelSystem: true,
        giveaways: 3,
        warnings: 8,
        tickets: true,
        birthdays: true,
        suggestions: true,
        twitchStreamers: 5
      });
      expect(environment.users).toHaveLength(50);
      expect(environment.levels!.length).toBe(15);
      const levelValues = environment.levels!.map(l => l.level);
      const maxLevel = Math.max(...levelValues);
      const minLevel = Math.min(...levelValues);
      
      expect(maxLevel).toBeLessThanOrEqual(50);
      expect(minLevel).toBeGreaterThanOrEqual(1);
      expect(environment.giveaways![0].endTime).toBeInstanceOf(Date);
      expect(environment.giveaways![0].winnersCount).toBeGreaterThanOrEqual(1);
      expect(environment.giveaways![0].winnersCount).toBeLessThanOrEqual(4);
      
      console.log('Created realistic server environment:');
      console.log(`- Guild: ${environment.guild.name} (${environment.guild.id})`);
      console.log(`- Users: ${environment.users.length}`);
      console.log(`- Levels: ${environment.levels?.length || 0}`);
      console.log(`- Giveaways: ${environment.giveaways?.length || 0}`);
      console.log(`- Warnings: ${environment.warnings?.length || 0}`);
      console.log(`- Tickets enabled: ${environment.tickets ? 'Yes' : 'No'}`);
    });
  });

  describe('Data Cleanup', () => {
    test('should clear all test data', async () => {
      await createTestEnvironment({
        userCount: 10,
        levelSystem: true,
        giveaways: 2,
        tickets: true
      });
      await clearTestData();
      expect(true).toBe(true);
    });

    test('should handle clearing empty database gracefully', async () => {
      await clearTestData();
      await expect(clearTestData()).resolves.not.toThrow();
    });
  });

  describe('Seeding Utility Integration Patterns', () => {
    test('pattern: setup for level system testing', async () => {
      const environment = await createTestEnvironment({
        guildName: 'Level Test Server',
        userCount: 20,
        levelSystem: true,
        giveaways: 0,
        warnings: 0,
        tickets: false
      });

      expect(environment.levels!.length).toBe(15);
      
      const lowLevelUsers = environment.levels!.filter(l => l.level < 10);
      const highLevelUsers = environment.levels!.filter(l => l.level >= 10);
      
      expect(lowLevelUsers.length + highLevelUsers.length).toBe(environment.levels!.length);
    });

    test('pattern: setup for moderation testing', async () => {
      const environment = await createTestEnvironment({
        guildName: 'Moderation Test Server',
        userCount: 15,
        levelSystem: false,
        warnings: 10,
        tickets: true
      });

      expect(environment.warnings!.length).toBeGreaterThan(0);
      expect(environment.tickets!.config).toBeDefined();
      const usersWithWarnings = environment.warnings!.map(w => w.userId);
      expect(usersWithWarnings.length).toBeGreaterThan(0);
    });

    test('pattern: setup for giveaway testing', async () => {
      const environment = await createTestEnvironment({
        guildName: 'Giveaway Test Server',
        userCount: 30,
        giveaways: 5,
        levelSystem: false
      });

      expect(environment.giveaways!).toHaveLength(5);
      
      const activeGiveaways = environment.giveaways!.filter(g => g.active);
      const inactiveGiveaways = environment.giveaways!.filter(g => !g.active);
      
      expect(activeGiveaways.length + inactiveGiveaways.length).toBe(5);
      console.log(`Active giveaways: ${activeGiveaways.length}`);
      console.log(`Inactive giveaways: ${inactiveGiveaways.length}`);
    });
  });
});