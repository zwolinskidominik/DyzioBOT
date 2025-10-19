import { CommandRunner, CommandResult } from './commandRunner';
import { DbManager } from '../setup/db';
import { clearCooldowns } from '../../../src/validations/globalCooldown';

describe('CommandRunner Usage Examples', () => {
  let commandRunner: CommandRunner;
  let dbManager: DbManager;

  beforeAll(async () => {
    // Setup database
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
    
    // Reset command runner
    CommandRunner.reset();
    commandRunner = CommandRunner.getInstance();
    commandRunner.clearLogs();
    commandRunner.clearCooldowns();
  });

  describe('Basic Usage Examples', () => {
    test('example: running a simple command', async () => {
      // Basic command execution
      const result: CommandResult = await commandRunner.runCommand('ping');
      
      expect(result.success).toBe(true);
      expect(result.replied).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      
      console.log('Command executed in:', result.executionTime, 'ms');
      console.log('Logs:', result.logs);
    });

    test('example: running command with custom user', async () => {
      // Command with custom user data
      const result: CommandResult = await commandRunner.runCommand('ping', {
        user: {
          id: 'test-user-123',
          username: 'testuser',
          discriminator: '1234',
        } as any
      });
      
      expect(result.success).toBe(true);
    });

    test('example: running command with options', async () => {
      // Command with string options - use unique user ID
      const result: CommandResult = await commandRunner.runCommand('test-options', {
        user: { id: 'options-example-user', username: 'optionsuser', discriminator: '0001' } as any,
        options: {
          text: 'test value'
        }
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Advanced Usage Examples', () => {
    test('example: testing cooldowns', async () => {
      // First execution should work
      const result1 = await commandRunner.runCommand('ping');
      expect(result1.success).toBe(true);
      
      // Second execution should be blocked by cooldown
      const result2 = await commandRunner.runCommand('ping');
      expect(result2.success).toBe(false);
      expect(result2.cooldownTriggered).toBe(true);
      expect(result2.error?.message).toContain('Odczekaj jeszcze');
    });

    test('example: testing with different configurations', async () => {
      // Create runner with cooldowns disabled
      const noCooldownRunner = new CommandRunner({
        enableCooldowns: false,
        enableValidations: false,
        enableLogging: true,
      });

      // Both executions should work
      const result1 = await noCooldownRunner.runCommand('ping');
      const result2 = await noCooldownRunner.runCommand('ping');
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    test('example: testing permissions', async () => {
      // Command with administrator permissions
      const result = await commandRunner.runCommand('ping', {
        memberPermissions: [BigInt(0x0000000000000008)] // ADMINISTRATOR
      });
      
      expect(result.success).toBe(true);
    });

    test('example: testing multiple users', async () => {
      // Different users can run commands simultaneously
      const userPromises = ['user1', 'user2', 'user3'].map(userId =>
        commandRunner.runCommand('ping', {
          user: { id: userId, username: userId, discriminator: '0001' } as any
        })
      );
      
      const results = await Promise.all(userPromises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Utility Examples', () => {
    test('example: checking available commands', async () => {
      // Get all loaded commands
      const commands = commandRunner.getCommands();
      console.log('Available commands:', Array.from(commands.keys()));
      
      expect(commands.size).toBeGreaterThan(0);
      
      // Check if specific command exists
      expect(commandRunner.hasCommand('ping')).toBe(true);
      expect(commandRunner.hasCommand('nonexistent')).toBe(false);
    });

    test('example: working with logs', async () => {
      // Run a command to generate logs
      await commandRunner.runCommand('ping');
      
      // Get and inspect logs
      const logs = commandRunner.getLogs();
      console.log('Execution logs:');
      logs.forEach(log => console.log('  ', log));
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toMatch(/Loading commands from:/);
      
      // Clear logs
      commandRunner.clearLogs();
      expect(commandRunner.getLogs().length).toBe(0);
    });

    test('example: handling command errors', async () => {
      // Try to run non-existent command
      const result = await commandRunner.runCommand('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not found');
      
      console.log('Error handled gracefully:', result.error?.message);
    });
  });

  describe('Integration Test Patterns', () => {
    test('pattern: command with database interaction', async () => {
      // This is how you'd test commands that interact with the database
      // The database is automatically set up and cleared between tests
      
      const result = await commandRunner.runCommand('ping');
      expect(result.success).toBe(true);
      
      // You can now verify database state if the command modifies data
    });

    test('pattern: testing command workflows', async () => {
      // Test a sequence of commands that might represent a user workflow
      
      // Step 1: User runs avatar command - use unique user ID
      const avatarResult = await commandRunner.runCommand('avatar', {
        user: { id: 'workflow-user-1', username: 'workflowuser', discriminator: '0001' } as any
      });
      expect(avatarResult.success).toBe(true);
      
      // Step 2: User runs specific command - use different unique user ID
      const pingResult = await commandRunner.runCommand('ping', {
        user: { id: 'workflow-user-2', username: 'workflowuser2', discriminator: '0002' } as any
      });
      expect(pingResult.success).toBe(true);
      
      // Verify the workflow completed successfully
      expect(avatarResult.replied).toBe(true);
      expect(pingResult.replied).toBe(true);
    });

    test('pattern: testing with realistic Discord data', async () => {
      // Create realistic mock data for testing
      const mockGuild = {
        id: '123456789012345678',
        name: 'Test Server',
        ownerId: '987654321098765432',
        memberCount: 150,
      };

      const mockUser = {
        id: '111222333444555666',
        username: 'testuser',
        discriminator: '0001',
        displayName: 'Test User',
      };

      const result = await commandRunner.runCommand('ping', {
        guild: mockGuild as any,
        user: mockUser as any,
        options: {
          // Add any command-specific options here
        }
      });

      expect(result.success).toBe(true);
    });
  });
});