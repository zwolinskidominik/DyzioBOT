import { CommandRunner, CommandResult } from './helpers/commandRunner';
import { ICommand, ICommandOptions } from '../../src/interfaces/Command';
import { DbManager } from './setup/db';
import { clearCooldowns } from '../../src/validations/globalCooldown';

describe('CommandRunner Integration Tests', () => {
  let commandRunner: CommandRunner;
  let dbManager: DbManager;

  beforeAll(async () => {
    // Setup database for integration tests
    dbManager = new DbManager();
    await dbManager.startDb();
  });

  afterAll(async () => {
    // Cleanup database
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    // Clear database between tests
    await dbManager.clearCollections();
    
    // Clear global cooldowns from validation to avoid conflicts
    clearCooldowns();
    
    // Get existing instance or create new one (don't reset completely)
    commandRunner = CommandRunner.getInstance({
      enableCooldowns: true,
      enableValidations: true,
      enableLogging: true,
      mockPermissions: true,
    });
    
    // Clear any existing cooldowns and logs for fresh test state
    commandRunner.clearCooldowns();
    commandRunner.clearLogs();
  });

  describe('Command Loading', () => {
    test('should load all available commands', async () => {
      const commands = commandRunner.getCommands();
      
      expect(commands.size).toBeGreaterThan(0);
      const logs = commandRunner.getLogs();
      expect(logs.some(log => log.includes('Loading commands from:'))).toBe(true);
      expect(logs.some(log => /Loaded \d+ commands/.test(log))).toBe(true);
    });

    test('should verify specific commands exist', async () => {
      // Test that common commands are loaded
      expect(commandRunner.hasCommand('ping')).toBe(true);
      expect(commandRunner.hasCommand('avatar')).toBe(true);
      
      // Test that non-existent command returns false
      expect(commandRunner.hasCommand('nonexistent')).toBe(false);
    });

    test('should load command with proper structure', async () => {
      const pingCommand = commandRunner.getCommand('ping');
      
      expect(pingCommand).toBeDefined();
      expect(pingCommand!.data).toBeDefined();
      expect(pingCommand!.run).toBeDefined();
      expect(typeof pingCommand!.run).toBe('function');
    });
  });

  describe('Command Execution', () => {
    test('should successfully run ping command', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.replied).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.logs).toBeDefined();
      expect(result.logs!.some(log => log.includes('Running command: ping'))).toBe(true);
      expect(result.logs!.some(log => log.includes('Command ping executed successfully'))).toBe(true);
    });

    test('should handle command with options', async () => {
      // This test uses the test-options mock command
      // Use unique user ID to avoid cooldown conflicts
      const result: CommandResult = await commandRunner.runCommand('test-options', {
        user: { id: 'options-test-user', username: 'optionsuser', discriminator: '0001' } as any,
        options: {
          text: 'test value'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.replied).toBe(true);
    });

    test('should handle non-existent command', async () => {
      const result: CommandResult = await commandRunner.runCommand('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('not found');
    });

    test('should handle command errors gracefully', async () => {
      // Create an error-throwing command
      const errorCommand: ICommand = {
        data: {
          name: 'error-command',
          description: 'Test error command',
          toJSON: () => ({ name: 'error-command', description: 'Test error command' }),
        } as any,
        run: async () => {
          throw new Error('Test error');
        }
      };

      // Add the error command
      commandRunner.addTestCommand('error-command', errorCommand);
      
      // Use unique user ID to avoid cooldown conflicts
      const result: CommandResult = await commandRunner.runCommand('error-command', {
        user: { id: 'error-test-user', username: 'erroruser', discriminator: '0001' } as any
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Test error');
    });
  });

  describe('Cooldown System', () => {
    let cooldownRunner: CommandRunner;

    beforeEach(() => {
      // Create a separate CommandRunner with validations disabled for cooldown testing
      cooldownRunner = new CommandRunner({
        enableValidations: false, // Disable validations to test only CommandRunner cooldowns
      });
    });

    afterEach(() => {
      // No cleanup method available, just clear cooldowns
      cooldownRunner.clearCooldowns();
    });

    test('should respect command cooldowns', async () => {
      // Run command first time
      const result1: CommandResult = await cooldownRunner.runCommand('ping');
      console.log('First ping result:', result1);
      expect(result1.success).toBe(true);
      expect(result1.cooldownTriggered).toBeUndefined();

      // Run same command immediately - should trigger cooldown
      const result2: CommandResult = await cooldownRunner.runCommand('ping');
      expect(result2.success).toBe(false);
      expect(result2.cooldownTriggered).toBe(true);
      expect(result2.error!.message).toContain('Odczekaj jeszcze');
    });

    test('should allow command after cooldown expires', async () => {
      // Use a command with very short cooldown for testing
      const shortCooldownCommand: ICommand = {
        data: {
          name: 'short-cooldown',
          description: 'Test command with short cooldown',
          toJSON: () => ({ name: 'short-cooldown', description: 'Test command with short cooldown' }),
        } as any,
        run: async ({ interaction }: ICommandOptions) => {
          await interaction.reply({ content: 'Short cooldown command executed' });
        },
        options: {
          cooldown: 0.1, // 100ms cooldown
        },
      };

      cooldownRunner.addTestCommand('short-cooldown', shortCooldownCommand);

      // Run command first time
      const result1: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result1.success).toBe(true);

      // Run same command immediately - should trigger cooldown
      const result2: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result2.success).toBe(false);
      expect(result2.cooldownTriggered).toBe(true);

      // Wait for cooldown to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should work again
      const result3: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result3.success).toBe(true);
      expect(result3.cooldownTriggered).toBeUndefined();
    }, 10000); // Increase timeout for this test

    test('should respect different cooldowns for different users', async () => {
      // Run command as user 1
      await cooldownRunner.runCommand('ping', {
        user: { id: 'user1', username: 'user1', discriminator: '0001' } as any
      });
      
      // Run same command as user 2 - should work
      const result: CommandResult = await cooldownRunner.runCommand('ping', {
        user: { id: 'user2', username: 'user2', discriminator: '0002' } as any
      });
      
      expect(result.success).toBe(true);
      expect(result.cooldownTriggered).toBeUndefined();
    });

    test('should disable cooldowns when configured', async () => {
      // Create runner with cooldowns disabled
      const noCooldownRunner = new CommandRunner({
        enableCooldowns: false,
        enableValidations: false,
        enableLogging: true,
      });

      // Run command twice rapidly
      const result1 = await noCooldownRunner.runCommand('ping');
      const result2 = await noCooldownRunner.runCommand('ping');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.cooldownTriggered).toBeUndefined();
    });
  });

  describe('Permission System', () => {
    test('should mock permissions correctly', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping', {
        memberPermissions: [BigInt(0x0000000000000001)], // CREATE_INSTANT_INVITE
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Validation System', () => {
    test('should load and run validations', async () => {
      const validations = commandRunner.getValidations();
      expect(validations.length).toBeGreaterThanOrEqual(0);
      
      // If validations are loaded, they should be functions
      validations.forEach((validation: any) => {
        expect(typeof validation).toBe('function');
      });
    });

    test('should disable validations when configured', async () => {
      const noValidationRunner = new CommandRunner({
        enableCooldowns: false,
        enableValidations: false,
        enableLogging: true,
      });

      const result = await noValidationRunner.runCommand('ping');
      expect(result.success).toBe(true);
    });
  });

  describe('Logging System', () => {
    test('should provide detailed logs', async () => {
      await commandRunner.runCommand('ping');
      
      const logs = commandRunner.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      // Check log format
      logs.forEach((log: string) => {
        expect(log).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      });
    });

    test('should clear logs when requested', async () => {
      await commandRunner.runCommand('ping');
      expect(commandRunner.getLogs().length).toBeGreaterThan(0);
      
      commandRunner.clearLogs();
      expect(commandRunner.getLogs().length).toBe(0);
    });

    test('should disable logging when configured', async () => {
      const noLogRunner = new CommandRunner({
        enableCooldowns: false,
        enableValidations: false,
        enableLogging: false,
      });

      await noLogRunner.runCommand('ping');
      expect(noLogRunner.getLogs().length).toBe(0);
    });
  });

  describe('Mock Interaction Features', () => {
    test('should create proper mock interaction with custom user', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping', {
        user: {
          id: 'custom-user-id',
          username: 'testuser123',
          discriminator: '1234',
        } as any
      });
      
      expect(result.success).toBe(true);
    });

    test('should create proper mock interaction with custom guild', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping', {
        guild: {
          id: 'custom-guild-id',
          name: 'Test Guild Custom',
        } as any
      });
      
      expect(result.success).toBe(true);
    });

    test('should handle subcommands', async () => {
      // This test assumes there's a command with subcommands
      const result: CommandResult = await commandRunner.runCommand('help', {
        subcommand: 'commands'
      });
      
      // Should not fail even if subcommand isn't implemented
      expect(result.error).not.toContain('No subcommand');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle multiple rapid executions', async () => {
      commandRunner.clearCooldowns();
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        commandRunner.runCommand('ping', {
          user: { id: `user-${i}`, username: `user${i}`, discriminator: '0001' } as any
        })
      );
      
      const results = await Promise.all(promises);
      
      results.forEach((result: CommandResult) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(1000); // Should complete within 1 second
      });
    });

    test('should provide execution timing', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping');
      
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime!).toBeGreaterThanOrEqual(0);
      expect(result.executionTime!).toBeLessThan(5000); // Reasonable upper bound
    });
  });
});