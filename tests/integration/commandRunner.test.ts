import { CommandRunner, CommandResult } from './helpers/commandRunner';
import { ICommand, ICommandOptions } from '../../src/interfaces/Command';
import { DbManager } from './setup/db';
import { clearCooldowns } from '../../src/validations/globalCooldown';

describe('CommandRunner Integration Tests', () => {
  let commandRunner: CommandRunner;
  let dbManager: DbManager;

  beforeAll(async () => {
    dbManager = new DbManager();
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await dbManager.clearCollections();
    clearCooldowns();
    commandRunner = CommandRunner.getInstance({
      enableCooldowns: true,
      enableValidations: true,
      enableLogging: true,
      mockPermissions: true,
    });
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
      expect(commandRunner.hasCommand('ping')).toBe(true);
      expect(commandRunner.hasCommand('avatar')).toBe(true);
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
      commandRunner.addTestCommand('error-command', errorCommand);
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
      cooldownRunner = new CommandRunner({
        enableValidations: false,
      });
    });

    afterEach(() => {
      cooldownRunner.clearCooldowns();
    });

    test('should respect command cooldowns', async () => {
      const result1: CommandResult = await cooldownRunner.runCommand('ping');
      console.log('First ping result:', result1);
      expect(result1.success).toBe(true);
      expect(result1.cooldownTriggered).toBeUndefined();
      const result2: CommandResult = await cooldownRunner.runCommand('ping');
      expect(result2.success).toBe(false);
      expect(result2.cooldownTriggered).toBe(true);
      expect(result2.error!.message).toContain('Odczekaj jeszcze');
    });

    test('should allow command after cooldown expires', async () => {
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
          cooldown: 0.1,
        },
      };

      cooldownRunner.addTestCommand('short-cooldown', shortCooldownCommand);
      const result1: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result1.success).toBe(true);
      const result2: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result2.success).toBe(false);
      expect(result2.cooldownTriggered).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 150));
      const result3: CommandResult = await cooldownRunner.runCommand('short-cooldown');
      expect(result3.success).toBe(true);
      expect(result3.cooldownTriggered).toBeUndefined();
    }, 10000);

    test('should respect different cooldowns for different users', async () => {
      await cooldownRunner.runCommand('ping', {
        user: { id: 'user1', username: 'user1', discriminator: '0001' } as any
      });
      const result: CommandResult = await cooldownRunner.runCommand('ping', {
        user: { id: 'user2', username: 'user2', discriminator: '0002' } as any
      });
      
      expect(result.success).toBe(true);
      expect(result.cooldownTriggered).toBeUndefined();
    });

    test('should disable cooldowns when configured', async () => {
      const noCooldownRunner = new CommandRunner({
        enableCooldowns: false,
        enableValidations: false,
        enableLogging: true,
      });
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
        memberPermissions: [BigInt(0x0000000000000001)],
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Validation System', () => {
    test('should load and run validations', async () => {
      const validations = commandRunner.getValidations();
      expect(validations.length).toBeGreaterThanOrEqual(0);
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
      const result: CommandResult = await commandRunner.runCommand('help', {
        subcommand: 'commands'
      });
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
        expect(result.executionTime).toBeLessThan(1000);
      });
    });

    test('should provide execution timing', async () => {
      const result: CommandResult = await commandRunner.runCommand('ping');
      
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime!).toBeGreaterThanOrEqual(0);
      expect(result.executionTime!).toBeLessThan(5000);
    });
  });
});