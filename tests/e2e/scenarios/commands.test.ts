import { E2ETestScenario, setupE2ETest } from '../mocks/discord';
import { MockDatabase, TestDataFactory } from '../mocks/database';
import { jest } from '@jest/globals';

// Simplified mock command handlers for testing
const mockCommandHandlers = {
  ping: {
    name: 'ping',
    description: 'Responds with pong!',
    async execute(interaction: any) {
      await interaction.reply({ content: 'Pong! 🏓' });
    },
  },
  level: {
    name: 'level',
    description: 'Shows user level information',
    async execute(interaction: any, models: any, targetUserId?: string) {
      const userId = targetUserId || interaction.user.id;
      
      // Get level data from database
      const levelData = await models.Level.findOne({
        userId: userId,
        guildId: interaction.guild.id,
      });

      if (!levelData) {
        await interaction.reply({
          content: `Użytkownik nie ma jeszcze żadnego poziomu na tym serwerze.`,
        });
        return;
      }

      await interaction.reply({
        embeds: [{
          title: `📊 Poziom użytkownika`,
          fields: [
            { name: 'Poziom', value: levelData.level.toString(), inline: true },
            { name: 'XP', value: `${levelData.xp}/${levelData.xpToNext || 1000}`, inline: true },
            { name: 'Całkowite XP', value: levelData.totalXp.toString(), inline: true },
          ],
          color: 0x00FF00,
        }],
      });
    },
  },
  giveaway: {
    name: 'giveaway',
    description: 'Creates a new giveaway',
    async execute(interaction: any, models: any, options: { prize: string; winners: number } = { prize: 'Test Prize', winners: 1 }) {
      // Check permissions
      if (!interaction.member.permissions.has('ManageMessages')) {
        await interaction.reply({
          content: '❌ Nie masz uprawnień do tworzenia konkursów!',
          ephemeral: true,
        });
        return;
      }

      const endTime = new Date(Date.now() + 3600000); // 1 hour from now

      // Create giveaway in database
      const giveaway = await models.Giveaway.create({
        messageId: '999888777666555444',
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        hostId: interaction.user.id,
        prize: options.prize,
        winnerCount: options.winners,
        endTime,
        active: true,
        participants: [],
      });

      await interaction.reply({
        embeds: [{
          title: '🎉 Konkurs!',
          description: `**Nagroda:** ${options.prize}\n**Liczba zwycięzców:** ${options.winners}`,
          color: 0xFF6B35,
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 1,
            label: 'Weź udział!',
            emoji: '🎉',
            custom_id: `giveaway_join_${giveaway._id}`,
          }],
        }],
      });
    },
  },
};

describe('Slash Commands E2E Tests', () => {
  let scenario: E2ETestScenario;
  let models: any;

  setupE2ETest();
  
  beforeAll(async () => {
    await MockDatabase.connect();
    
    // Register all models used in the application
    models = {
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
    scenario = new E2ETestScenario('Test Guild');
    // Clear all data before each test
    await TestDataFactory.clearDatabase(models);
  });

  afterAll(async () => {
    await MockDatabase.disconnect();
  });

  describe('Basic Commands', () => {
    test('should respond to ping command', async () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('ping');

      // Act
      await mockCommandHandlers.ping.execute(interaction);

      // Assert
      scenario.expectInteractionReply(interaction, 'Pong!');
    });

    test('should handle command name correctly', () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('ping');

      // Assert
      expect(interaction.commandName).toBe('ping');
      expect(interaction.isChatInputCommand()).toBe(true);
    });
  });

  describe('Level System Commands', () => {
    test('should show user level information', async () => {
      // Arrange
      const levelData = TestDataFactory.createTestLevel({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
        level: 5,
        xp: 750,
        totalXp: 2500,
      });
      await models.Level.create(levelData);

      const interaction = scenario.createUserSlashCommand('level');

      // Act
      await mockCommandHandlers.level.execute(interaction, models);

      // Assert
      scenario.expectInteractionReply(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Poziom użytkownika'),
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'Poziom', value: '5' }),
                expect.objectContaining({ name: 'XP', value: expect.stringContaining('750') }),
                expect.objectContaining({ name: 'Całkowite XP', value: '2500' }),
              ]),
            }),
          ]),
        })
      );
    });

    test('should handle user with no level data', async () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('level');

      // Act
      await mockCommandHandlers.level.execute(interaction, models);

      // Assert
      scenario.expectInteractionReply(interaction, 'nie ma jeszcze żadnego poziomu');
    });

    test('should show specific user level when target specified', async () => {
      // Arrange
      const otherUserId = '999999999999999999';
      const levelData = TestDataFactory.createTestLevel({
        userId: otherUserId,
        guildId: scenario.guild.id,
        level: 10,
        xp: 250,
        totalXp: 5000,
      });
      await models.Level.create(levelData);

      const interaction = scenario.createUserSlashCommand('level');

      // Act - Pass the target user ID as a parameter
      await mockCommandHandlers.level.execute(interaction, models, otherUserId);

      // Assert
      scenario.expectInteractionReply(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'Poziom', value: '10' }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe('Giveaway Commands', () => {
    test('should create giveaway with proper permissions', async () => {
      // Arrange
      const interaction = scenario.createAdminSlashCommand('giveaway');
      const options = { prize: 'Discord Nitro', winners: 1 };

      // Act
      await mockCommandHandlers.giveaway.execute(interaction, models, options);

      // Assert
      scenario.expectInteractionReply(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '🎉 Konkurs!',
              description: expect.stringContaining('Discord Nitro'),
            }),
          ]),
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  label: 'Weź udział!',
                  custom_id: expect.stringContaining('giveaway_join_'),
                }),
              ]),
            }),
          ]),
        })
      );

      // Check database
      const giveaways = await models.Giveaway.find({
        guildId: scenario.guild.id,
        hostId: scenario.adminUser.id,
      });
      expect(giveaways).toHaveLength(1);
      expect(giveaways[0].prize).toBe('Discord Nitro');
    });

    test('should deny giveaway creation without permissions', async () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('giveaway');
      const options = { prize: 'Test Prize', winners: 1 };

      // Act
      await mockCommandHandlers.giveaway.execute(interaction, models, options);

      // Assert
      scenario.expectInteractionReply(interaction, 'Nie masz uprawnień');
    });
  });

  describe('Command Error Handling', () => {
    test('should handle missing level data gracefully', async () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('level');

      // Act
      await mockCommandHandlers.level.execute(interaction, models);

      // Assert - Should handle gracefully when no level data exists
      scenario.expectInteractionReply(interaction, 'nie ma jeszcze żadnego poziomu');
    });

    test('should validate permissions for giveaway command', async () => {
      // Arrange
      const interaction = scenario.createUserSlashCommand('giveaway');
      const options = { prize: 'Test Prize', winners: 1 };

      // Act
      await mockCommandHandlers.giveaway.execute(interaction, models, options);

      // Assert - Should deny access without proper permissions
      scenario.expectInteractionReply(interaction, 'Nie masz uprawnień');
    });
  });

  describe('Multi-Step Command Workflows', () => {
    test('should handle complete giveaway lifecycle', async () => {
      // Step 1: Create giveaway
      const createInteraction = scenario.createAdminSlashCommand('giveaway');
      const options = { prize: 'Test Prize', winners: 1 };

      await mockCommandHandlers.giveaway.execute(createInteraction, models, options);

      // Verify giveaway creation
      const giveaways = await models.Giveaway.find({ guildId: scenario.guild.id });
      expect(giveaways).toHaveLength(1);
      expect(giveaways[0].prize).toBe('Test Prize');
      expect(giveaways[0].active).toBe(true);
      expect(giveaways[0].participants).toHaveLength(0);

      // Step 2: Simulate user joining giveaway
      const giveaway = giveaways[0];
      giveaway.participants.push(scenario.regularUser.id);
      await giveaway.save();

      // Verify participation
      const updatedGiveaway = await models.Giveaway.findById(giveaway._id);
      expect(updatedGiveaway.participants).toContain(scenario.regularUser.id);
      expect(updatedGiveaway.participants).toHaveLength(1);

      // Step 3: Simulate ending giveaway
      updatedGiveaway.active = false;
      updatedGiveaway.endTime = new Date();
      await updatedGiveaway.save();

      // Verify completion
      const finalGiveaway = await models.Giveaway.findById(giveaway._id);
      expect(finalGiveaway.active).toBe(false);
    });
  });

  describe('Button Interactions', () => {
    test('should create button interactions correctly', () => {
      // Arrange & Act
      const buttonInteraction = scenario.createButtonInteraction('test_button');

      // Assert
      expect(buttonInteraction.customId).toBe('test_button');
      expect(buttonInteraction.isButton()).toBe(true);
      expect(buttonInteraction.isChatInputCommand()).toBe(false);
      expect(buttonInteraction.user).toBe(scenario.regularUser);
    });

    test('should create select menu interactions correctly', () => {
      // Arrange & Act
      const selectInteraction = scenario.createSelectMenuInteraction('test_select', ['option1', 'option2']);

      // Assert
      expect(selectInteraction.customId).toBe('test_select');
      expect(selectInteraction.values).toEqual(['option1', 'option2']);
      expect(selectInteraction.isStringSelectMenu()).toBe(true);
      expect(selectInteraction.isChatInputCommand()).toBe(false);
    });
  });

  describe('Database Operations', () => {
    test('should handle multiple concurrent database operations', async () => {
      // Arrange
      const users = Array.from({ length: 5 }, (_, i) => ({
        userId: `user${i}`,
        guildId: scenario.guild.id,
        level: i + 1,
        xp: (i + 1) * 500,
        totalXp: (i + 1) * 1000,
      }));

      // Act - Create multiple level records concurrently
      await Promise.all(
        users.map(user => models.Level.create(TestDataFactory.createTestLevel(user)))
      );

      // Assert - All records should be created
      const allLevels = await models.Level.find({ guildId: scenario.guild.id });
      expect(allLevels).toHaveLength(5);
      
      // Verify specific levels
      const userLevels = await models.Level.find({ 
        guildId: scenario.guild.id,
        userId: { $in: users.map(u => u.userId) }
      });
      expect(userLevels).toHaveLength(5);
    });

    test('should handle database query with complex filters', async () => {
      // Arrange
      const testData = [
        { userId: 'user1', level: 5, xp: 500, active: true },
        { userId: 'user2', level: 10, xp: 750, active: false },
        { userId: 'user3', level: 15, xp: 1000, active: true },
      ];

      for (const data of testData) {
        await models.Level.create(TestDataFactory.createTestLevel({
          ...data,
          guildId: scenario.guild.id,
        }));
      }

      // Act - Query with complex filters
      const activeLevels = await models.Level.find({
        guildId: scenario.guild.id,
        level: { $gte: 5 },
        xp: { $gt: 600 },
      });

      // Assert
      expect(activeLevels).toHaveLength(2);
      expect(activeLevels.every((level: any) => level.level >= 5 && level.xp > 600)).toBe(true);
    });
  });
});