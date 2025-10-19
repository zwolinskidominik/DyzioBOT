import type { Client, ChatInputCommandInteraction, GuildMember, Guild, User, Channel } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { ICommand, ICommandOptions } from '../../../src/interfaces/Command';
import logger from '../../../src/utils/logger';

export interface MockInteractionOptions {
  commandName: string;
  subcommand?: string;
  options?: { [key: string]: any };
  user?: Partial<User>;
  guild?: Partial<Guild>;
  member?: Partial<GuildMember>;
  channel?: Partial<Channel>;
  permissions?: bigint[];
  memberPermissions?: bigint[];
}

export interface CommandResult {
  success: boolean;
  error?: Error;
  replied?: boolean;
  deferred?: boolean;
  ephemeral?: boolean;
  response?: string;
  logs?: string[];
  executionTime?: number;
  cooldownTriggered?: boolean;
  permissionError?: string;
}

export interface CommandRunnerOptions {
  enableCooldowns?: boolean;
  enableValidations?: boolean;
  enableLogging?: boolean;
  mockPermissions?: boolean;
  realCommands?: boolean;
}

/**
 * Enhanced helper class for running real Discord commands in integration tests
 * Loads actual command files and executes them with mocked interactions
 * Supports cooldowns, validations, permission checking, and detailed logging
 */
export class CommandRunner {
  private static instance: CommandRunner;
  private commands: Map<string, ICommand> = new Map();
  private validations: Array<(interaction: any, command: ICommand) => Promise<string | null>> = [];
  private commandsLoaded = false;
  private validationsLoaded = false;
  private cooldowns: Map<string, number> = new Map();
  private logs: string[] = [];
  private options: CommandRunnerOptions;

  constructor(options: CommandRunnerOptions = {}) {
    this.options = {
      enableCooldowns: true,
      enableValidations: true,
      enableLogging: true,
      mockPermissions: true,
      ...options,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CommandRunnerOptions): CommandRunner {
    if (!CommandRunner.instance) {
      CommandRunner.instance = new CommandRunner(options);
    }
    return CommandRunner.instance;
  }

  /**
   * Reset singleton instance (useful for tests)
   */
  public static reset(): void {
    CommandRunner.instance = undefined as any;
  }

  /**
   * Load all commands from the src/commands directory
   */
  private loadCommands(): void {
    if (this.commandsLoaded) return;
    if (this.options.realCommands) {
      this.loadRealCommands();
    } else {
      // Fallback: small internal mock set
      this.createMockCommands();
    }
    
    this.commandsLoaded = true;
    this.log(`Loaded ${this.commands.size} commands`);
  }

  /**
   * Recursively load real command modules from src/commands
   */
  private loadRealCommands(): void {
    // Ensure we can require .ts files dynamically when running under Jest
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tsnode = require('ts-node');
      if (tsnode && typeof tsnode.register === 'function') {
        tsnode.register({
          transpileOnly: true,
          compilerOptions: {
            module: 'CommonJS',
            target: 'ES2022',
            moduleResolution: 'Node',
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            esModuleInterop: true,
            resolveJsonModule: true,
          },
        });
        this.log('ts-node.register configured for dynamic TS requires');
      }
    } catch (e) {
      this.log(`ts-node not available or failed to register: ${e}`);
    }

    const root = join(__dirname, '../../../src/commands');
    this.log(`Loading commands from: ${root}`);

    const walk = (dir: string) => {
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch (e) {
        this.log(`Failed to read commands dir ${dir}: ${e}`);
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory()) {
            walk(full);
          } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
            // Clear cache for fresh imports in tests
            try { delete require.cache[require.resolve(full)]; } catch {}
            const mod = require(full);
            const exported = mod?.default && mod.default.data && mod.default.run
              ? mod.default
              : mod;
            const data = exported.data;
            const run = exported.run;
            if (!data || !run) continue;

            // Try to infer command name
            let name: string | undefined = (data as any).name;
            if (!name && typeof data.toJSON === 'function') {
              try { name = data.toJSON().name; } catch {}
            }
            if (!name) continue;

            const command: ICommand = {
              data,
              run,
              options: exported.options || {},
            };
            this.commands.set(name, command);
          }
        } catch (e) {
          this.log(`Failed to load command from ${full}: ${e}`);
        }
      }
    };

    walk(root);
  }

  /**
   * Create mock commands for testing
   */
  private createMockCommands(): void {
    const mockCommands = [
      {
        name: 'ping',
        description: 'Test ping command',
        cooldown: 1,
        execute: async (interaction: any, client: any) => {
          await interaction.deferReply();
          const reply = await interaction.fetchReply();
          const clientPing = reply.createdTimestamp - interaction.createdTimestamp;
          const websocketPing = client.ws.ping;
          await interaction.editReply({ content: `🏓 Pong! Client: ${clientPing}ms, WebSocket: ${websocketPing}ms` });
        }
      },
      {
        name: 'avatar',
        description: 'Test avatar command',
        execute: async (interaction: any) => {
          await interaction.reply({ content: 'Avatar command executed' });
        }
      },
      {
        name: 'test-options',
        description: 'Test command with options',
        execute: async (interaction: any) => {
          const option = interaction.options.get('text')?.value || 'default';
          await interaction.reply({ content: `Option value: ${option}` });
        }
      }
    ];

    mockCommands.forEach(mockCmd => {
      // Create a mock SlashCommandBuilder
      const mockData = {
        name: mockCmd.name,
        description: mockCmd.description,
        toJSON: () => ({ name: mockCmd.name, description: mockCmd.description }),
      } as any;

      const command: ICommand = {
        data: mockData,
        run: async ({ interaction, client }: ICommandOptions) => {
          await mockCmd.execute(interaction, client);
        },
        options: {
          cooldown: mockCmd.cooldown || 0,
        },
      };

      this.commands.set(mockCmd.name, command);
    });

    this.log(`Loading commands from: test-mock-commands`);
  }

  /**
   * Load all validations from the src/validations directory
   */
  private loadValidations(): void {
    if (this.validationsLoaded || !this.options.enableValidations) return;

    const validationsPath = join(__dirname, '../../../src/validations');
    this.log(`Loading validations from: ${validationsPath}`);

    try {
      for (const entry of readdirSync(validationsPath)) {
        if (!entry.endsWith('.ts') && !entry.endsWith('.js')) continue;

        const fullPath = join(validationsPath, entry);
        
        try {
          // Clear require cache for fresh imports
          delete require.cache[require.resolve(fullPath)];
          const validationModule = require(fullPath);

          // Most validation modules export a default function
          if (typeof validationModule.default === 'function') {
            this.validations.push(validationModule.default);
            this.log(`Loaded validation: ${entry}`);
          } else if (typeof validationModule === 'function') {
            this.validations.push(validationModule);
            this.log(`Loaded validation: ${entry}`);
          }
        } catch (error) {
          this.log(`Failed to load validation ${entry}: ${error}`);
        }
      }
    } catch (error) {
      this.log(`Failed to read validations directory: ${error}`);
    }

    this.validationsLoaded = true;
    this.log(`Loaded ${this.validations.length} validations`);
  }

  /**
   * Add log entry
   */
  private log(message: string): void {
    if (this.options.enableLogging) {
      this.logs.push(`[${new Date().toISOString()}] ${message}`);
    }
  }

  /**
   * Check cooldowns for a user/command combination
   */
  private checkCooldown(userId: string, commandName: string, cooldownMs: number): string | null {
    if (!this.options.enableCooldowns) return null;

    const key = `${userId}:${commandName}`;
    const now = Date.now();
    const until = this.cooldowns.get(key) || 0;

    if (until > now) {
      const remainingSeconds = Math.ceil((until - now) / 1000);
      return `Odczekaj jeszcze ${remainingSeconds} sekund przed ponownym użyciem tej komendy.`;
    }

    this.cooldowns.set(key, now + cooldownMs);
    return null;
  }

  /**
   * Run validations against the interaction and command
   */
  private async runValidations(interaction: any, command: ICommand): Promise<string | null> {
    if (!this.options.enableValidations) return null;

    for (const validate of this.validations) {
      try {
        const errorMessage = await validate(interaction, command);
        if (errorMessage) {
          return errorMessage;
        }
      } catch (error) {
        if (this.options.enableLogging) {
          this.log(`Validation error: ${error}`);
        }
        return `Validation failed: ${error}`;
      }
    }
    return null;
  }

  /**
   * Create a mocked Discord interaction for testing
   */
  private createMockInteraction(options: MockInteractionOptions, client: Client): ChatInputCommandInteraction {
    const mockUser = {
      id: '123456789',
      username: 'testuser',
      discriminator: '0001',
      displayName: 'Test User',
      bot: false,
      system: false,
      ...options.user,
    } as User;

    const mockChannel = {
      id: '987654321',
      name: 'test-channel',
      type: 0, // GuildText
      guild: null,
      ...options.channel,
    } as Channel;

    const mockGuild = {
      id: '555666777',
      name: 'Test Guild',
      ownerId: '123456789',
      memberCount: 100,
      ...options.guild,
    } as Guild;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      joinedAt: new Date(),
      permissions: {},
      ...options.member,
    } as GuildMember;

    // Mock permissions
    if (this.options.mockPermissions && options.memberPermissions) {
      const permissionsBigInt = options.memberPermissions.reduce((acc, perm) => acc | perm, 0n);
      (mockMember as any).permissions = {
        has: (permission: any) => (permissionsBigInt & BigInt(permission)) === BigInt(permission),
        missing: () => [],
        toArray: () => options.memberPermissions || [],
      };
    }

    // options storage not required as we provide getters below

    const mockInteraction = {
      id: 'interaction-' + Date.now(),
      type: 2, // ApplicationCommand
      commandName: options.commandName,
      user: mockUser,
      member: mockMember,
      guild: mockGuild,
      channel: mockChannel,
      client: client,
      options: {
        get: (name: string) => {
          const value = options.options?.[name];
          return value ? { name, value, type: typeof value === 'string' ? 3 : typeof value === 'number' ? 4 : 5 } : null;
        },
        getSubcommand: (required?: boolean) => {
          if (options.subcommand) return options.subcommand;
          if (required) throw new Error('No subcommand');
          return null;
        },
        getString: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required string option: ${name}`);
          return value ? String(value) : null;
        },
        getInteger: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required integer option: ${name}`);
          return value ? parseInt(String(value)) : null;
        },
        getBoolean: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (value === undefined && required) throw new Error(`Missing required boolean option: ${name}`);
          return value ? Boolean(value) : null;
        },
        getUser: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required user option: ${name}`);
          return value || null;
        },
        getMember: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required member option: ${name}`);
          return value || null;
        },
        getChannel: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required channel option: ${name}`);
          return value || null;
        },
        getRole: (name: string, required?: boolean) => {
          const value = options.options?.[name];
          if (!value && required) throw new Error(`Missing required role option: ${name}`);
          return value || null;
        },
        data: undefined as any,
      },
      replied: false,
      deferred: false,
      ephemeral: false,
      reply: jest.fn(async (content: any) => {
        mockInteraction.replied = true;
        if (typeof content === 'object' && content.ephemeral) {
          mockInteraction.ephemeral = true;
        }
        return { id: 'reply-' + Date.now(), createdTimestamp: Date.now() } as any;
      }),
      editReply: jest.fn(async (content: any) => {
        mockInteraction.replied = true;
        return { id: 'edit-reply-' + Date.now(), createdTimestamp: Date.now() } as any;
      }),
      deferReply: jest.fn(async (options?: any) => {
        mockInteraction.deferred = true;
        if (options?.ephemeral) {
          mockInteraction.ephemeral = true;
        }
      }),
      followUp: jest.fn(async (content: any) => {
        return { id: 'followup-' + Date.now(), createdTimestamp: Date.now() } as any;
      }),
      deleteReply: jest.fn(async () => {}),
      fetchReply: jest.fn(async () => ({ 
        id: 'fetched-reply', 
        createdTimestamp: Date.now() + 10 // Simulate slight delay for ping calculation
      } as any)),
      createdTimestamp: Date.now(),
      createdAt: new Date(),
    } as unknown as ChatInputCommandInteraction;

    return mockInteraction;
  }

  /**
   * Create a basic mocked Discord client
   */
  private createMockClient(): Client {
    const mockClient = {
      user: {
        id: '999888777',
        username: 'TestBot',
        discriminator: '0000',
        tag: 'TestBot#0000',
      },
  users: new Map(),
  guilds: new Map(),
  channels: new Map(),
      isReady: () => true,
      uptime: 60000,
      readyTimestamp: Date.now() - 60000,
      readyAt: new Date(Date.now() - 60000),
      ws: {
        ping: 42, // Mock websocket ping
      },
    } as unknown as Client;

    return mockClient;
  }

  /**
   * Run a command with the given options
   */
  public async runCommand(
    commandName: string,
    interactionOptions: Omit<MockInteractionOptions, 'commandName'> = {},
    client?: Client
  ): Promise<CommandResult> {
  const startTime = Date.now();
    
    // Load commands and validations if not already loaded
    this.loadCommands();
    this.loadValidations();

    // Find the command
    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        error: new Error(`Command '${commandName}' not found`),
        logs: [...this.logs],
        executionTime: Math.max(1, Date.now() - startTime),
      };
    }

    // Create mock client if not provided
    const mockClient = client || this.createMockClient();

    // Create mock interaction
    const mockInteraction = this.createMockInteraction(
      { ...interactionOptions, commandName },
      mockClient
    );

    this.log(`Running command: ${commandName}`);

    try {
      // Check cooldowns
      const cooldownSeconds = command.options?.cooldown || 2.5; // Default 2.5s like production
      const cooldownMs = cooldownSeconds * 1000; // Convert seconds to milliseconds
      const cooldownError = this.checkCooldown(
        mockInteraction.user.id,
        commandName,
        cooldownMs
      );

      if (cooldownError) {
        this.log(`Cooldown triggered for ${commandName}: ${cooldownError}`);
        return {
          success: false,
          error: new Error(cooldownError),
          cooldownTriggered: true,
          logs: [...this.logs],
          executionTime: Math.max(1, Date.now() - startTime),
        };
      }

      // Run validations
      const validationError = await this.runValidations(mockInteraction, command);
      if (validationError) {
        this.log(`Validation failed for ${commandName}: ${validationError}`);
        return {
          success: false,
          error: new Error(validationError),
          permissionError: validationError,
          logs: [...this.logs],
          executionTime: Math.max(1, Date.now() - startTime),
        };
      }

      // Execute the command
      await command.run({
        interaction: mockInteraction,
        client: mockClient,
      });

      this.log(`Command ${commandName} executed successfully`);

      return {
        success: true,
        replied: mockInteraction.replied,
        deferred: mockInteraction.deferred,
        ephemeral: mockInteraction.ephemeral || false,
        logs: [...this.logs],
        executionTime: Math.max(1, Date.now() - startTime),
      };
    } catch (error) {
      this.log(`Command ${commandName} failed: ${error}`);
      
      return {
        success: false,
        error: error as Error,
        replied: mockInteraction.replied,
        deferred: mockInteraction.deferred,
        ephemeral: mockInteraction.ephemeral || false,
        logs: [...this.logs],
        executionTime: Math.max(1, Date.now() - startTime),
      };
    }
  }

  /**
   * Add a temporary command for testing (replaces existing if exists)
   */
  public addTestCommand(name: string, command: ICommand): void {
    this.commands.set(name, command);
  }

  /**
   * Remove a command
   */
  public removeCommand(name: string): void {
    this.commands.delete(name);
  }

  /**
   * Get all loaded commands
   */
  public getCommands(): Map<string, ICommand> {
    this.loadCommands();
    return new Map(this.commands);
  }

  /**
   * Get all loaded validations
   */
  public getValidations(): Array<(interaction: any, command: ICommand) => Promise<string | null>> {
    this.loadValidations();
    return [...this.validations];
  }

  /**
   * Get execution logs
   */
  public getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear execution logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Clear cooldowns (useful for testing)
   */
  public clearCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Get command by name
   */
  public getCommand(name: string): ICommand | undefined {
    this.loadCommands();
    return this.commands.get(name);
  }

  /**
   * Check if command exists
   */
  public hasCommand(name: string): boolean {
    this.loadCommands();
    return this.commands.has(name);
  }
}

export default CommandRunner;