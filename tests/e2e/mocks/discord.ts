// @ts-nocheck
import { jest } from '@jest/globals';
import { 
  Client, 
  Guild, 
  GuildMember, 
  User, 
  TextChannel, 
  VoiceChannel,
  ChatInputCommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  Message,
  Role,
  PermissionsBitField,
  Collection,
  GuildMemberManager,
  ChannelManager,
  RoleManager,
  MessageManager,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

// Mock Discord.js structures for E2E testing
export class MockDiscordClient {
  public guilds: Collection<string, Guild>;
  public user: User | null;
  private eventListeners: Map<string, Function[]>;

  constructor() {
    this.guilds = new Collection();
    this.user = null;
    this.eventListeners = new Map();
  }

  // Mock methods
  public on(event: string, listener: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  public emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }

  public login(token: string): Promise<string> {
    return Promise.resolve('mock-token');
  }

  // Setup helper
  public setupMockBot(botUser: Partial<User> = {}) {
    this.user = this.createMockUser({
      id: '123456789012345678',
      username: 'DyzioBot',
      discriminator: '0000',
      bot: true,
      ...botUser,
    });
  }

  // Factory methods
  public createMockGuild(options: Partial<Guild> & { id: string; name: string }): Guild {
    const guild = {
      id: options.id,
      name: options.name,
      ownerId: options.ownerId || '987654321012345678',
      memberCount: options.memberCount || 100,
      
      // Collections
      members: new Collection<string, GuildMember>(),
      channels: new Collection<string, TextChannel | VoiceChannel>(),
      roles: new Collection<string, Role>(),
      
      // Managers
      members: {
        cache: new Collection<string, GuildMember>(),
        fetch: jest.fn().mockResolvedValue(null),
        add: jest.fn().mockResolvedValue(null),
        remove: jest.fn().mockResolvedValue(null),
      } as any,
      
      channels: {
        cache: new Collection<string, TextChannel | VoiceChannel>(),
        fetch: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((options: any) => {
          const channelId = `temp-${Date.now()}`;
          const tempChannel = this.createMockVoiceChannel(guild, {
            id: channelId,
            name: options.name || 'temp-channel',
            type: options.type || 2,
          });
          return Promise.resolve(tempChannel);
        }),
      } as any,
      
      roles: {
        cache: new Collection<string, Role>(),
        fetch: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
      } as any,

      // Methods
      iconURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/icons/guild.png'),
      
      ...options,
    } as Guild;

    this.guilds.set(guild.id, guild);
    return guild;
  }

  public createMockUser(options: Partial<User> & { id: string }): User {
    return {
      id: options.id,
      username: options.username || 'TestUser',
      discriminator: options.discriminator || '1234',
      bot: options.bot || false,
      avatar: options.avatar || null,
      
      // Methods
      displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/avatars/user.png'),
      toString: jest.fn().mockReturnValue(`<@${options.id}>`),
      
      ...options,
    } as User;
  }

  public createMockMember(guild: Guild, user: User, options: Partial<GuildMember> = {}): GuildMember {
    const member = {
      id: user.id,
      user: user,
      guild: guild,
      nickname: options.nickname || null,
      roles: {
        cache: new Collection<string, Role>(),
        add: jest.fn().mockResolvedValue(null),
        remove: jest.fn().mockResolvedValue(null),
        highest: options.roles?.highest || null,
      },
      permissions: options.permissions || new PermissionsBitField(),
      joinedAt: options.joinedAt || new Date(),
      
      // Voice state
      voice: {
        channel: null,
        setChannel: jest.fn().mockResolvedValue(null),
      },
      
      // Methods
      displayName: options.nickname || user.username,
      toString: jest.fn().mockReturnValue(`<@${user.id}>`),
      kick: jest.fn().mockResolvedValue(null),
      ban: jest.fn().mockResolvedValue(null),
      timeout: jest.fn().mockResolvedValue(null),
      
      ...options,
    } as GuildMember;

    guild.members.cache.set(user.id, member);
    return member;
  }

  public createMockTextChannel(guild: Guild, options: Partial<TextChannel> & { id: string; name: string }): TextChannel {
    const channel = {
      id: options.id,
      name: options.name,
      guild: guild,
      type: 0, // TEXT_CHANNEL
      messages: {
        cache: new Collection<string, Message>(),
        fetch: jest.fn().mockResolvedValue(null),
      },
      
      // Methods
      send: jest.fn().mockResolvedValue(this.createMockMessage(options.id)),
      bulkDelete: jest.fn().mockResolvedValue(new Collection()),
      setName: jest.fn().mockResolvedValue(null),
      setTopic: jest.fn().mockResolvedValue(null),
      
      ...options,
    } as TextChannel;

    guild.channels.cache.set(channel.id, channel);
    return channel;
  }

  public createMockVoiceChannel(guild: Guild, options: Partial<VoiceChannel> & { id: string; name: string }): VoiceChannel {
    const channel = {
      id: options.id,
      name: options.name,
      guild: guild,
      type: 2, // VOICE_CHANNEL
      members: new Collection<string, GuildMember>(),
      
      // Methods
      setName: jest.fn().mockResolvedValue(null),
      setUserLimit: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(null),
      
      ...options,
    } as VoiceChannel;

    guild.channels.cache.set(channel.id, channel);
    return channel;
  }

  public createMockRole(guild: Guild, options: Partial<Role> & { id: string; name: string }): Role {
    const role = {
      id: options.id,
      name: options.name,
      guild: guild,
      color: options.color || 0,
      hoist: options.hoist || false,
      position: options.position || 0,
      permissions: options.permissions || new PermissionsBitField(),
      mentionable: options.mentionable || true,
      
      // Methods
      toString: jest.fn().mockReturnValue(`<@&${options.id}>`),
      delete: jest.fn().mockResolvedValue(null),
      edit: jest.fn().mockResolvedValue(null),
      
      ...options,
    } as Role;

    guild.roles.cache.set(role.id, role);
    return role;
  }

  public createMockMessage(channelId: string, options: Partial<Message> = {}): Message {
    const mockMessage = {
      id: options.id || '999888777666555444',
      content: options.content || 'Test message',
      author: options.author || this.createMockUser({ id: '111222333444555666' }),
      channel: (options as any).channel || {
        id: channelId,
        send: jest.fn(),
      },
      guild: options.guild || null,
      embeds: options.embeds || [],
      reactions: {
        cache: new Collection(),
      },
      
      // Methods
      delete: jest.fn(),
      edit: jest.fn(),
      reply: jest.fn(),
      react: jest.fn(),
      
      ...options,
    };
    
    return mockMessage as any;
  }

  public createMockInteraction<T extends 'chatInput' | 'button' | 'selectMenu'>(
    type: T,
    options: {
      id?: string;
      user: User;
      guild: Guild;
      channel: TextChannel;
      commandName?: string;
      customId?: string;
      values?: string[];
      options?: any[];
    }
  ): T extends 'chatInput' ? ChatInputCommandInteraction : 
     T extends 'button' ? ButtonInteraction : 
     SelectMenuInteraction {
    
    const baseInteraction = {
      id: options.id || '777888999000111222',
      user: options.user,
      member: options.guild.members.cache.get(options.user.id),
      guild: options.guild,
      channel: options.channel,
      client: this as any,
      
      // Response methods
      deferred: false,
      replied: false,
      reply: jest.fn().mockImplementation(async (response) => {
        (baseInteraction as any).replied = true;
        return null;
      }),
      deferReply: jest.fn().mockImplementation(async () => {
        (baseInteraction as any).deferred = true;
        return null;
      }),
      editReply: jest.fn(),
      followUp: jest.fn(),
      deleteReply: jest.fn(),
    };

    if (type === 'chatInput') {
      return {
        ...baseInteraction,
        commandName: options.commandName || 'test',
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        options: {
          get: jest.fn(),
          getString: jest.fn(),
          getUser: jest.fn(),
          getInteger: jest.fn(),
          getBoolean: jest.fn(),
          getChannel: jest.fn(),
          getRole: jest.fn(),
          getSubcommand: jest.fn(),
          getSubcommandGroup: jest.fn(),
        },
      } as any;
    }

    if (type === 'button') {
      return {
        ...baseInteraction,
        customId: options.customId || 'test-button',
        isButton: () => true,
        isChatInputCommand: () => false,
        isStringSelectMenu: () => false,
        update: jest.fn(),
      } as any;
    }

    if (type === 'selectMenu') {
      return {
        ...baseInteraction,
        customId: options.customId || 'test-select',
        values: options.values || [],
        isStringSelectMenu: () => true,
        isChatInputCommand: () => false,
        isButton: () => false,
        update: jest.fn(),
      } as any;
    }

    throw new Error(`Unsupported interaction type: ${type}`);
  }
}

// Scenario builder for common test setups
export class E2ETestScenario {
  public client: MockDiscordClient;
  public guild: Guild;
  public textChannel: TextChannel;
  public voiceChannel: VoiceChannel;
  public adminUser: User;
  public regularUser: User;
  public adminMember: GuildMember;
  public regularMember: GuildMember;
  public adminRole: Role;
  public memberRole: Role;

  constructor(guildName: string = 'Test Guild') {
    this.client = new MockDiscordClient();
    this.client.setupMockBot();

    // Create guild
    this.guild = this.client.createMockGuild({
      id: '123456789012345678',
      name: guildName,
    } as any);

    // Create channels
    this.textChannel = this.client.createMockTextChannel(this.guild, {
      id: '111111111111111111',
      name: 'general',
    } as any);

    this.voiceChannel = this.client.createMockVoiceChannel(this.guild, {
      id: '222222222222222222',
      name: 'General Voice',
    } as any);

    // Create roles
    this.adminRole = this.client.createMockRole(this.guild, {
      id: '333333333333333333',
      name: 'Admin',
      permissions: new PermissionsBitField(['Administrator']),
    } as any);

    this.memberRole = this.client.createMockRole(this.guild, {
      id: '444444444444444444',
      name: 'Member',
      permissions: new PermissionsBitField(['ViewChannel', 'SendMessages']),
    } as any);

    // Create users
    this.adminUser = this.client.createMockUser({
      id: '555555555555555555',
      username: 'AdminUser',
    } as any);

    this.regularUser = this.client.createMockUser({
      id: '666666666666666666',
      username: 'RegularUser',
    } as any);

    // Create members
    this.adminMember = this.client.createMockMember(this.guild, this.adminUser, {
      permissions: new PermissionsBitField(['Administrator']),
    } as any);
    this.adminMember.roles.cache.set(this.adminRole.id, this.adminRole);

    this.regularMember = this.client.createMockMember(this.guild, this.regularUser, {
      permissions: new PermissionsBitField(['ViewChannel', 'SendMessages']),
    });
    this.regularMember.roles.cache.set(this.memberRole.id, this.memberRole);
  }

  // Helper methods for creating interactions
  public createAdminSlashCommand(commandName: string, options: any[] = []) {
    return this.client.createMockInteraction('chatInput', {
      user: this.adminUser,
      guild: this.guild,
      channel: this.textChannel,
      commandName,
      options,
    });
  }

  public createUserSlashCommand(commandName: string, options: any[] = []) {
    return this.client.createMockInteraction('chatInput', {
      user: this.regularUser,
      guild: this.guild,
      channel: this.textChannel,
      commandName,
      options,
    });
  }

  public createButtonInteraction(customId: string, user: User = this.regularUser) {
    return this.client.createMockInteraction('button', {
      user,
      guild: this.guild,
      channel: this.textChannel,
      customId,
    });
  }

  public createSelectMenuInteraction(customId: string, values: string[], user: User = this.regularUser) {
    return this.client.createMockInteraction('selectMenu', {
      user,
      guild: this.guild,
      channel: this.textChannel,
      customId,
      values,
    });
  }

  // Event simulation helpers
  public simulateMemberJoin(user?: User): GuildMember {
    const newUser = user || this.client.createMockUser({
      id: `${Date.now()}`,
      username: `NewUser${Date.now()}`,
    });
    
    const member = this.client.createMockMember(this.guild, newUser);
    this.client.emit('guildMemberAdd', member);
    return member;
  }

  public simulateMemberLeave(member: GuildMember = this.regularMember) {
    this.guild.members.cache.delete(member.id);
    this.client.emit('guildMemberRemove', member);
  }

  public simulateMessage(content: string, author: User = this.regularUser): Message {
    const message = this.client.createMockMessage(this.textChannel.id, {
      content,
      author,
      guild: this.guild,
      channel: this.textChannel, // Pass the actual channel object
    });
    
    this.client.emit('messageCreate', message);
    return message;
  }

  public simulateVoiceStateUpdate(member: GuildMember, fromChannel?: VoiceChannel, toChannel?: VoiceChannel) {
    const oldState = {
      member,
      channel: fromChannel || null,
      channelId: fromChannel?.id || null,
      guild: this.guild,
    };
    
    const newState = {
      member,
      channel: toChannel || null,
      channelId: toChannel?.id || null,
      guild: this.guild,
    };

    this.client.emit('voiceStateUpdate', oldState, newState);
  }

  // Assertion helpers
  public expectChannelMessage(channel: TextChannel, content?: string) {
    expect(channel.send).toHaveBeenCalled();
    if (content) {
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining(content),
        })
      );
    }
  }

  public expectEmbedMessage(channel: TextChannel, title?: string) {
    expect(channel.send).toHaveBeenCalled();
    if (title) {
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining(title),
              }),
            }),
          ]),
        })
      );
    }
  }

  public expectInteractionReply(interaction: any, content?: string) {
    expect(interaction.reply || interaction.editReply).toHaveBeenCalled();
    if (content) {
      expect(interaction.reply || interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining(content),
        })
      );
    }
  }

  public expectErrorReply(interaction: any) {
    expect(interaction.reply || interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringMatching(/błąd|error|niepowodzenie/i),
      })
    );
  }
}

// Global setup for E2E tests
export const setupE2ETest = () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
};