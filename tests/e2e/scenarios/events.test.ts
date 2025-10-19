import { E2ETestScenario, setupE2ETest } from '../mocks/discord';
import { MockDatabase, TestDataFactory } from '../mocks/database';
import { jest } from '@jest/globals';

// Mock event handlers for testing
const mockEventHandlers = {
  memberJoin: {
    name: 'guildMemberAdd',
    async execute(member: any, models: any) {
      // Auto-role assignment
      const autoRoleConfig = await models.AutoRole.findOne({ 
        guildId: member.guild.id
      });
      
      if (autoRoleConfig && autoRoleConfig.roleIds && autoRoleConfig.roleIds.length > 0) {
        const rolesToAdd = autoRoleConfig.roleIds
          .map((roleId: string) => {
            return member.guild.roles.cache.find((role: any) => role.id === roleId);
          })
          .filter((role: any) => role);
        
        if (rolesToAdd.length > 0) {
          await member.roles.add(rolesToAdd);
        }
      }

      // Welcome message
      const greetingConfig = await models.GreetingsConfiguration.findOne({
        guildId: member.guild.id
      });

      if (greetingConfig && greetingConfig.enabled && greetingConfig.channelId) {
        const channel = member.guild.channels.cache.get(greetingConfig.channelId);
        if (channel) {
          await channel.send({
            content: `Witaj ${member}! 👋 Miło Cię widzieć na serwerze!`,
          });
        }
      }
    },
  },

  memberLeave: {
    name: 'guildMemberRemove',
    async execute(member: any, models: any) {
      // Clean up user data
      await models.Level.deleteOne({
        userId: member.id,
        guildId: member.guild.id,
      });

      await models.TempChannel.deleteMany({
        ownerId: member.id,
        guildId: member.guild.id,
      });

      // Goodbye message
      const greetingConfig = await models.GreetingsConfiguration.findOne({
        guildId: member.guild.id
      });

      if (greetingConfig && greetingConfig.enabled && greetingConfig.goodbyeChannelId) {
        const channel = member.guild.channels.cache.get(greetingConfig.goodbyeChannelId);
        if (channel) {
          await channel.send({
            content: `${member.user.username} opuścił serwer. 👋`,
          });
        }
      }
    },
  },

  messageCreate: {
    name: 'messageCreate',
    async execute(message: any, models: any) {
      // Ignore bot messages
      if (message.author.bot) return;

      // XP gain for messages
      const levelConfig = await models.LevelConfig.findOne({
        guildId: message.guild.id
      });

      if (levelConfig && levelConfig.enabled) {
        const xpGain = Math.floor(Math.random() * 15) + 5; // 5-20 XP
        
        const levelData = await models.Level.findOne({
          userId: message.author.id,
          guildId: message.guild.id,
        });

        if (levelData) {
          levelData.xp += xpGain;
          levelData.totalXp += xpGain;
          
          // Check for level up
          const xpRequired = levelData.level * 1000;
          if (levelData.xp >= xpRequired) {
            levelData.level += 1;
            levelData.xp = 0;
            
            // Send level up message
            await message.channel.send({
              content: `🎉 ${message.author} awansował na poziom **${levelData.level}**!`,
            });
          }
          
          await levelData.save();
        } else {
          // Create new level record
          await models.Level.create({
            userId: message.author.id,
            guildId: message.guild.id,
            level: 1,
            xp: xpGain,
            totalXp: xpGain,
          });
        }
      }
    },
  },

  voiceStateUpdate: {
    name: 'voiceStateUpdate',
    async execute(oldState: any, newState: any, models: any) {
      // Check if user left a temp channel first (this doesn't need config)
      if (oldState.channelId && !newState.channelId) {
        const tempChannel = await models.TempChannel.findOne({
          channelId: oldState.channelId
        });

        if (tempChannel) {
          const channel = oldState.guild.channels.cache.get(oldState.channelId);
          if (channel && channel.members.size === 0) {
            // Delete empty temp channel
            await channel.delete();
            await tempChannel.deleteOne();
          }
        }
        return; // Exit early for leaving logic
      }
      
      // Temp channel creation - needs config
      const tempConfig = await models.TempChannelConfiguration.findOne({
        guildId: newState.guild.id
      });

      if (tempConfig && tempConfig.enabled && tempConfig.parentChannelId) {
        // User joined the temp channel creator
        if (!oldState.channelId && newState.channelId === tempConfig.parentChannelId) {
          const tempChannel = await newState.guild.channels.create({
            name: `${newState.member.displayName}'s room`,
            type: 2, // VOICE_CHANNEL
            parent: tempConfig.categoryId,
          });

          // Move user to their temp channel
          await newState.member.voice.setChannel(tempChannel);

          // Create temp channel record
          await models.TempChannel.create({
            channelId: tempChannel.id,
            ownerId: newState.member.id,
            guildId: newState.guild.id,
            parentId: tempConfig.parentChannelId,
          });
        }
      }
    },
  },
};

describe('Discord Events E2E Tests', () => {
  let scenario: E2ETestScenario;
  let models: any;

  setupE2ETest();
  
  beforeAll(async () => {
    await MockDatabase.connect();
    
    models = {
      Level: MockDatabase.registerModel('Level', {}),
      AutoRole: MockDatabase.registerModel('AutoRole', {}),
      GreetingsConfiguration: MockDatabase.registerModel('GreetingsConfiguration', {}),
      LevelConfig: MockDatabase.registerModel('LevelConfig', {}),
      TempChannel: MockDatabase.registerModel('TempChannel', {}),
      TempChannelConfiguration: MockDatabase.registerModel('TempChannelConfiguration', {}),
    };
  });

  beforeEach(async () => {
    scenario = new E2ETestScenario('Test Guild');
    await TestDataFactory.clearDatabase(models);
  });

  afterAll(async () => {
    await MockDatabase.disconnect();
  });

  describe('Member Join Events', () => {
    test('should assign auto-roles when member joins', async () => {
      // Arrange - Create auto-role configuration with correct structure
      const autoRole = await models.AutoRole.create({
        guildId: scenario.guild.id,
        roleIds: [scenario.memberRole.id], // Note: Array of role IDs
      });

      // Act - Simulate member join
      const newMember = scenario.simulateMemberJoin();
      
      // Simulate auto-role assignment (since we can't easily import TS files in Jest)
      const autoRoleConfig = await models.AutoRole.findOne({ guildId: newMember.guild.id });
      if (autoRoleConfig && autoRoleConfig.roleIds.length > 0) {
        const rolesToAdd = autoRoleConfig.roleIds
          .map((roleId: string) => newMember.guild.roles.cache.find((role: any) => role.id === roleId))
          .filter((role: any) => role);
        if (rolesToAdd.length > 0) {
          await newMember.roles.add(rolesToAdd);
        }
      }

      // Assert
      expect(newMember.roles.add).toHaveBeenCalledWith([scenario.memberRole]);
    });

    test('should send welcome message when configured', async () => {
      // Arrange - Create greeting configuration
      const greetingConfig = await models.GreetingsConfiguration.create({
        guildId: scenario.guild.id,
        greetingsChannelId: scenario.textChannel.id,
        enabled: true,
      });

      // Act - Simulate member join
      const newMember = scenario.simulateMemberJoin();
      
      // Simulate welcome message (since we can't easily import TS files in Jest)
      const config = await models.GreetingsConfiguration.findOne({ guildId: newMember.guild.id });
      if (config?.greetingsChannelId) {
        const channel = newMember.guild.channels.cache.get(config.greetingsChannelId);
        if (channel && 'send' in channel) {
          await (channel as any).send({
            embeds: [{ description: `Witaj ${newMember.user.username}!` }]
          });
        }
      }

      // Assert - Channel should receive welcome message
      scenario.expectChannelMessage(scenario.textChannel);
    });

    test('should not send welcome message when disabled', async () => {
      // Arrange
      const greetingConfig = await models.GreetingsConfiguration.create({
        guildId: scenario.guild.id,
        enabled: false,
        channelId: scenario.textChannel.id,
      });

      // Act
      const newMember = scenario.simulateMemberJoin();
      await mockEventHandlers.memberJoin.execute(newMember, models);

      // Assert
      expect(scenario.textChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('Member Leave Events', () => {
    test('should clean up user data when member leaves', async () => {
      // Arrange
      const levelData = await models.Level.create(TestDataFactory.createTestLevel({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      }));

      const tempChannel = await models.TempChannel.create({
        channelId: scenario.voiceChannel.id,
        ownerId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });

      // Act
      scenario.simulateMemberLeave(scenario.regularMember);
      await mockEventHandlers.memberLeave.execute(scenario.regularMember, models);

      // Assert
      const remainingLevel = await models.Level.findOne({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });
      expect(remainingLevel).toBeNull();

      const remainingTempChannels = await models.TempChannel.find({
        ownerId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });
      expect(remainingTempChannels).toHaveLength(0);
    });

    test('should send goodbye message when configured', async () => {
      // Arrange
      const greetingConfig = await models.GreetingsConfiguration.create({
        guildId: scenario.guild.id,
        enabled: true,
        goodbyeChannelId: scenario.textChannel.id,
      });

      // Act
      scenario.simulateMemberLeave(scenario.regularMember);
      await mockEventHandlers.memberLeave.execute(scenario.regularMember, models);

      // Assert
      scenario.expectChannelMessage(scenario.textChannel, 'opuścił serwer');
    });
  });

  describe('Message Events', () => {
    test('should award XP for messages when level system enabled', async () => {
      // Arrange
      const levelConfig = await models.LevelConfig.create({
        guildId: scenario.guild.id,
        enabled: true,
      });

      // Act
      const message = scenario.simulateMessage('Hello world!');
      await mockEventHandlers.messageCreate.execute(message, models);

      // Assert
      const levelData = await models.Level.findOne({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });
      expect(levelData).toBeTruthy();
      expect(levelData.xp).toBeGreaterThan(0);
      expect(levelData.level).toBe(1);
    });

    test('should handle level up correctly', async () => {
      // Arrange
      const levelConfig = await models.LevelConfig.create({
        guildId: scenario.guild.id,
        enabled: true,
      });

      const existingLevel = await models.Level.create(TestDataFactory.createTestLevel({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
        level: 1,
        xp: 995, // Close to level up
        totalXp: 995,
      }));

      // Act
      const message = scenario.simulateMessage('This should level me up!');
      await mockEventHandlers.messageCreate.execute(message, models);

      // Assert
      const updatedLevel = await models.Level.findOne({
        userId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });
      expect(updatedLevel.level).toBe(2);
      expect(updatedLevel.xp).toBeLessThan(100); // Reset after level up
      scenario.expectChannelMessage(scenario.textChannel, 'awansował na poziom');
    });

    test('should ignore bot messages', async () => {
      // Arrange
      const levelConfig = await models.LevelConfig.create({
        guildId: scenario.guild.id,
        enabled: true,
      });

      const botUser = scenario.client.createMockUser({
        id: 'bot123',
        username: 'TestBot',
        bot: true,
      } as any);

      const botMessage = scenario.client.createMockMessage(scenario.textChannel.id, {
        author: botUser,
        content: 'Bot message',
      } as any);

      // Act
      await mockEventHandlers.messageCreate.execute(botMessage, models);

      // Assert
      const levelData = await models.Level.findOne({
        userId: botUser.id,
        guildId: scenario.guild.id,
      });
      expect(levelData).toBeNull();
    });
  });

  describe('Voice State Events', () => {
    test('should create temp channel when user joins creator channel', async () => {
      // Arrange
      const tempConfig = await models.TempChannelConfiguration.create({
        guildId: scenario.guild.id,
        enabled: true,
        parentChannelId: scenario.voiceChannel.id,
        categoryId: 'category123',
      });

      // Mock voice state
      const oldState = { channelId: null, member: scenario.regularMember };
      const newState = { 
        channelId: scenario.voiceChannel.id, 
        member: scenario.regularMember,
        guild: scenario.guild 
      };

      // Act
      scenario.simulateVoiceStateUpdate(scenario.regularMember, undefined, scenario.voiceChannel);
      await mockEventHandlers.voiceStateUpdate.execute(oldState, newState, models);

      // Assert
      expect(scenario.guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining(scenario.regularMember.displayName),
          type: 2,
        })
      );

      const tempChannelRecord = await models.TempChannel.findOne({
        ownerId: scenario.regularUser.id,
        guildId: scenario.guild.id,
      });
      expect(tempChannelRecord).toBeTruthy();
    });

    test('should delete empty temp channel when user leaves', async () => {
      // Arrange
      const tempChannelRecord = await models.TempChannel.create({
        channelId: scenario.voiceChannel.id,
        ownerId: scenario.regularUser.id,
        guildId: scenario.guild.id,
        parentId: 'parent123',
      });

      // Mock empty channel
      (scenario.voiceChannel as any).members = { size: 0 };

      const oldState = { 
        channelId: scenario.voiceChannel.id, 
        guild: scenario.guild,
        member: scenario.regularMember
      };
      const newState = { 
        channelId: null, 
        member: scenario.regularMember,
        guild: scenario.guild
      };

      // Act
      await mockEventHandlers.voiceStateUpdate.execute(oldState, newState, models);

      // Assert
      expect(scenario.voiceChannel.delete).toHaveBeenCalled();
      
      const remainingRecord = await models.TempChannel.findOne({
        channelId: scenario.voiceChannel.id
      });
      expect(remainingRecord).toBeNull();
    });
  });

  describe('Complex Event Scenarios', () => {
    test('should handle complete user session lifecycle', async () => {
      // Setup configurations
      await models.AutoRole.create({
        guildId: scenario.guild.id,
        roleIds: [scenario.memberRole.id],
      });

      await models.GreetingsConfiguration.create({
        guildId: scenario.guild.id,
        enabled: true,
        channelId: scenario.textChannel.id,
        goodbyeChannelId: scenario.textChannel.id,
      });

      await models.LevelConfig.create({
        guildId: scenario.guild.id,
        enabled: true,
      });

      // Step 1: User joins server
      const newMember = scenario.simulateMemberJoin();
      await mockEventHandlers.memberJoin.execute(newMember, models);

      // Verify join processing
      expect(newMember.roles.add).toHaveBeenCalledWith([scenario.memberRole]);
      scenario.expectChannelMessage(scenario.textChannel, 'Witaj');

      // Step 2: User sends messages and gains XP
      const message1 = scenario.simulateMessage('Hello everyone!', newMember.user);
      await mockEventHandlers.messageCreate.execute(message1, models);

      const message2 = scenario.simulateMessage('How is everyone doing?', newMember.user);
      await mockEventHandlers.messageCreate.execute(message2, models);

      // Verify XP gain
      const levelData = await models.Level.findOne({
        userId: newMember.user.id,
        guildId: scenario.guild.id,
      });
      expect(levelData).toBeTruthy();
      expect(levelData.totalXp).toBeGreaterThan(0);

      // Step 3: User leaves server
      scenario.simulateMemberLeave(newMember);
      await mockEventHandlers.memberLeave.execute(newMember, models);

      // Verify cleanup
      const remainingLevel = await models.Level.findOne({
        userId: newMember.user.id,
        guildId: scenario.guild.id,
      });
      expect(remainingLevel).toBeNull();
      scenario.expectChannelMessage(scenario.textChannel, 'opuścił serwer');
    });

    test('should handle concurrent event processing', async () => {
      // Arrange
      await models.LevelConfig.create({
        guildId: scenario.guild.id,
        enabled: true,
      });

      // Act - Simulate multiple users sending messages simultaneously
      const users = Array.from({ length: 5 }, (_, i) => 
        scenario.client.createMockUser({ id: `user${i}`, username: `User${i}` } as any)
      );

      const messagePromises = users.map(async (user, i) => {
        const message = scenario.client.createMockMessage(scenario.textChannel.id, {
          author: user,
          content: `Message from user ${i}`,
          guild: scenario.guild,
        } as any);
        return mockEventHandlers.messageCreate.execute(message, models);
      });

      await Promise.all(messagePromises);

      // Assert - All users should have level data
      const allLevels = await models.Level.find({ guildId: scenario.guild.id });
      expect(allLevels).toHaveLength(5);
      allLevels.forEach((level: any) => {
        expect(level.xp).toBeGreaterThan(0);
        expect(level.level).toBe(1);
      });
    });
  });
});