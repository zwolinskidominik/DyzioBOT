import {
  Client,
  User,
  Guild,
  GuildMember,
  Channel,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  UserSelectMenuInteraction,
  MentionableSelectMenuInteraction,
  ModalSubmitInteraction,
  Collection,
  MessageFlags,
  ChannelType,
  InteractionType,
  ComponentType,
  ButtonStyle,
  PermissionsBitField,
} from 'discord.js';

/**
 * Fluent API builder for creating Discord interactions in tests
 * Supports ChatInputCommand, Button, SelectMenu, and Modal interactions
 */
export class InteractionBuilder<T = ChatInputCommandInteraction> {
  private interactionData: Partial<T> = {};
  private userData: Partial<User> = {};
  private guildData: Partial<Guild> = {};
  private memberData: Partial<GuildMember> = {};
  private channelData: Partial<Channel> = {};
  private clientData: Partial<Client> = {};
  private commandOptions: { [key: string]: any } = {};
  private componentCustomId = '';
  private selectValues: string[] = [];
  private modalFieldsData: { [key: string]: string } = {};
  private subcommandName?: string;
  private expectedType?: string; // To track specific interaction type

  // Interaction state tracking
  private replied = false;
  private deferred = false;
  private ephemeral = false;
  private lastResponse?: string;

  constructor() {
    // Set default values
    this.setDefaultUser();
    this.setDefaultGuild();
    this.setDefaultChannel();
    this.setDefaultClient();
  }

  private setDefaultUser(): this {
    this.userData = {
      id: '123456789012345678',
      username: 'testuser',
      discriminator: '0000',
      globalName: 'Test User',
      avatar: null,
      bot: false,
      system: false,
      tag: 'testuser#0000',
      createdTimestamp: Date.now() - 86400000, // 1 day ago
    } as any; // Type assertion for test mock
    return this;
  }

  private setDefaultGuild(): this {
    this.guildData = {
      id: '987654321098765432',
      name: 'Test Guild',
      icon: null,
      splash: null,
      ownerId: '111222333444555666',
      memberCount: 100,
      createdTimestamp: Date.now() - 86400000 * 30, // 30 days ago
      members: {} as any, // Mock manager
      channels: {} as any, // Mock manager
      roles: {} as any, // Mock manager
    } as any; // Type assertion for test mock
    return this;
  }

  private setDefaultChannel(): this {
    this.channelData = {
      id: '555666777888999000',
      type: ChannelType.GuildText,
      name: 'test-channel',
      createdTimestamp: Date.now() - 86400000 * 7, // 7 days ago
    } as any; // Type assertion for test mock
    return this;
  }

  private setDefaultClient(): this {
    this.clientData = {
      user: {
        id: '111222333444555666',
        username: 'TestBot',
        discriminator: '0000',
        avatar: null,
        bot: true,
      } as any, // Mock ClientUser
      application: {
        id: '111222333444555666',
      } as any, // Mock Application
      ws: {
        ping: 50,
      } as any, // Mock WebSocketManager
    } as any; // Type assertion for test mock
    return this;
  }

  // Fluent API methods

  /**
   * Set command name for ChatInputCommandInteraction
   */
  command(name: string): this {
    this.interactionData = {
      ...this.interactionData,
      commandName: name,
      type: InteractionType.ApplicationCommand,
    };
    return this;
  }

  /**
   * Set subcommand for command interactions
   */
  subcommand(name: string): this {
    this.subcommandName = name;
    return this;
  }

  /**
   * Set custom ID for component interactions
   */
  customId(id: string): this {
    this.componentCustomId = id;
    return this;
  }

  /**
   * Set values for select menu interactions
   */
  values(values: string[]): this {
    this.selectValues = values;
    return this;
  }

  /**
   * Set modal fields for modal submit interactions
   */
  modalFields(fields: { [key: string]: string }): this {
    this.modalFieldsData = fields;
    return this;
  }

  // Set expected interaction type for proper building
  setType(type: string): this {
    this.expectedType = type;
    return this;
  }

  /**
   * Set user data
   */
  user(userData: Partial<User>): this {
    this.userData = { ...this.userData, ...userData };
    return this;
  }

  /**
   * Set guild data
   */
  guild(guildData: Partial<Guild>): this {
    this.guildData = { ...this.guildData, ...guildData };
    return this;
  }

  /**
   * Set member data
   */
  member(memberData: Partial<GuildMember>): this {
    this.memberData = { ...this.memberData, ...memberData };
    return this;
  }

  /**
   * Set channel data
   */
  channel(channelData: Partial<Channel>): this {
    this.channelData = { ...this.channelData, ...channelData } as any;
    return this;
  }

  /**
   * Set client data
   */
  client(clientData: Partial<Client>): this {
    this.clientData = { ...this.clientData, ...clientData };
    return this;
  }

  /**
   * Set command/component options
   */
  options(options: { [key: string]: any }): this {
    this.commandOptions = { ...this.commandOptions, ...options };
    return this;
  }

  /**
   * Create mock interaction methods
   */
  private createMockMethods() {
    return {
      deferReply: jest.fn(async (opts?: { ephemeral?: boolean; fetchReply?: boolean }) => {
        this.deferred = true;
        if (opts?.ephemeral) this.ephemeral = true;
        return opts?.fetchReply ? {} : undefined;
      }),

      reply: jest.fn(async (content: any) => {
        this.replied = true;
        if (typeof content === 'string') {
          this.lastResponse = content;
        } else if (content?.content) {
          this.lastResponse = content.content;
        }
        if (content?.flags && (content.flags & MessageFlags.Ephemeral)) {
          this.ephemeral = true;
        }
        return {};
      }),

      editReply: jest.fn(async (content: any) => {
        if (typeof content === 'string') {
          this.lastResponse = content;
        } else if (content?.content) {
          this.lastResponse = content.content;
        }
        return {};
      }),

      followUp: jest.fn(async (content: any) => {
        if (typeof content === 'string') {
          this.lastResponse = content;
        } else if (content?.content) {
          this.lastResponse = content.content;
        }
        return {};
      }),

      deferUpdate: jest.fn(async () => {
        this.deferred = true;
      }),

      update: jest.fn(async (content: any) => {
        this.replied = true;
        if (typeof content === 'string') {
          this.lastResponse = content;
        } else if (content?.content) {
          this.lastResponse = content.content;
        }
      }),

      showModal: jest.fn(async () => {}),

      fetchReply: jest.fn(async () => ({
        id: '999888777666555444',
        content: this.lastResponse || '',
        embeds: [],
        components: [],
      })),

      // State getters for testing
      replied: () => this.replied,
      deferred: () => this.deferred,
    };
  }

  /**
   * Create command options mock
   */
  private createOptionsBinding() {
    return {
      getSubcommand: jest.fn(() => this.subcommandName),
      getString: jest.fn((name: string) => this.commandOptions[name] as string),
      getInteger: jest.fn((name: string) => this.commandOptions[name] as number),
      getBoolean: jest.fn((name: string) => this.commandOptions[name] as boolean),
      getUser: jest.fn((name: string) => this.commandOptions[name] as User),
      getChannel: jest.fn((name: string) => this.commandOptions[name] as Channel),
      getRole: jest.fn((name: string) => this.commandOptions[name]),
      getMentionable: jest.fn((name: string) => this.commandOptions[name]),
      getNumber: jest.fn((name: string) => this.commandOptions[name] as number),
      getAttachment: jest.fn((name: string) => this.commandOptions[name]),
      getFocused: jest.fn(() => this.commandOptions.focused || false),
      getSubcommandGroup: jest.fn(() => this.commandOptions.subcommandGroup),
      data: {
        name: (this.interactionData as any).commandName || 'test-command',
        options: Object.entries(this.commandOptions).map(([name, value]) => ({
          name,
          value,
          type: typeof value === 'string' ? 3 : typeof value === 'number' ? 4 : 5,
        })),
      },
    };
  }

  /**
   * Build ChatInputCommandInteraction
   */
  buildChatInput(): ChatInputCommandInteraction {
    const mockUser = this.userData as User;
    const mockGuild = this.guildData as Guild;
    const mockChannel = this.channelData as Channel;
    const mockClient = this.clientData as Client;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      permissions: new PermissionsBitField([]),
      ...this.memberData,
    } as GuildMember;

    const methods = this.createMockMethods();
    const optionsBinding = this.createOptionsBinding();

    const interaction = {
      type: InteractionType.ApplicationCommand,
      commandName: (this.interactionData as any).commandName || 'test-command',
      id: '123456789012345678',
      token: 'mock-token',
      applicationId: mockClient.application?.id || '111222333444555666',
      user: mockUser,
      guild: mockGuild,
      member: mockMember,
      channel: mockChannel,
      client: mockClient,
      createdTimestamp: Date.now(),
      options: optionsBinding,
      isChatInputCommand: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isModalSubmit: () => false,
      isRepliable: () => true,
      inGuild: () => true,
      inCachedGuild: () => true,
      inRawGuild: () => false,
      ...methods,
      // Test state accessor - reference to live state
      _testState: this,
      ...this.interactionData,
    } as unknown as ChatInputCommandInteraction;

    return interaction;
  }

  /**
   * Build ButtonInteraction
   */
  buildButton(): ButtonInteraction {
    const mockUser = this.userData as User;
    const mockGuild = this.guildData as Guild;
    const mockChannel = this.channelData as Channel;
    const mockClient = this.clientData as Client;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      permissions: new PermissionsBitField([]),
      ...this.memberData,
    } as GuildMember;

    const methods = this.createMockMethods();

    const interaction = {
      type: InteractionType.MessageComponent,
      componentType: ComponentType.Button,
      customId: this.componentCustomId || 'test-button',
      id: '123456789012345678',
      token: 'mock-token',
      applicationId: mockClient.application?.id || '111222333444555666',
      user: mockUser,
      guild: mockGuild,
      member: mockMember,
      channel: mockChannel,
      client: mockClient,
      createdTimestamp: Date.now(),
      component: {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        customId: this.componentCustomId || 'test-button',
        label: 'Test Button',
      },
      message: {
        id: '999888777666555444',
        content: 'Test message',
        author: mockUser,
        embeds: [],
        components: [],
      },
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isModalSubmit: () => false,
      isRepliable: () => true,
      inGuild: () => true,
      inCachedGuild: () => true,
      inRawGuild: () => false,
      ...methods,
      _testState: this,
      ...this.interactionData,
    } as unknown as ButtonInteraction;

    return interaction;
  }

  /**
   * Build StringSelectMenuInteraction
   */
  buildStringSelectMenu(): StringSelectMenuInteraction {
    const mockUser = this.userData as User;
    const mockGuild = this.guildData as Guild;
    const mockChannel = this.channelData as Channel;
    const mockClient = this.clientData as Client;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      permissions: new PermissionsBitField([]),
      ...this.memberData,
    } as GuildMember;

    const methods = this.createMockMethods();

    const interaction = {
      type: InteractionType.MessageComponent,
      componentType: ComponentType.StringSelect,
      customId: this.componentCustomId || 'test-select',
      values: this.selectValues,
      id: '123456789012345678',
      token: 'mock-token',
      applicationId: mockClient.application?.id || '111222333444555666',
      user: mockUser,
      guild: mockGuild,
      member: mockMember,
      channel: mockChannel,
      client: mockClient,
      createdTimestamp: Date.now(),
      component: {
        type: ComponentType.StringSelect,
        customId: this.componentCustomId || 'test-select',
        options: [],
      },
      message: {
        id: '999888777666555444',
        content: 'Test message',
        author: mockUser,
        embeds: [],
        components: [],
      },
      isChatInputCommand: () => false,
      isButton: () => false,
      isStringSelectMenu: () => true,
      isChannelSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isModalSubmit: () => false,
      isRepliable: () => true,
      inGuild: () => true,
      inCachedGuild: () => true,
      inRawGuild: () => false,
      ...methods,
      _testState: this,
      ...this.interactionData,
    } as unknown as StringSelectMenuInteraction;

    return interaction;
  }

  /**
   * Build ChannelSelectMenuInteraction
   */
  buildChannelSelectMenu(): ChannelSelectMenuInteraction {
    const mockUser = this.userData as User;
    const mockGuild = this.guildData as Guild;
    const mockChannel = this.channelData as Channel;
    const mockClient = this.clientData as Client;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      permissions: new PermissionsBitField([]),
      ...this.memberData,
    } as GuildMember;

    const methods = this.createMockMethods();

    const interaction = {
      type: InteractionType.MessageComponent,
      componentType: ComponentType.ChannelSelect,
      customId: this.componentCustomId || 'test-channel-select',
      values: this.selectValues,
      channels: new Collection(),
      id: '123456789012345678',
      token: 'mock-token',
      applicationId: mockClient.application?.id || '111222333444555666',
      user: mockUser,
      guild: mockGuild,
      member: mockMember,
      channel: mockChannel,
      client: mockClient,
      createdTimestamp: Date.now(),
      component: {
        type: ComponentType.ChannelSelect,
        customId: this.componentCustomId || 'test-channel-select',
        channelTypes: [ChannelType.GuildText],
      },
      message: {
        id: '999888777666555444',
        content: 'Test message',
        author: mockUser,
        embeds: [],
        components: [],
      },
      isChatInputCommand: () => false,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => true,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isModalSubmit: () => false,
      isRepliable: () => true,
      inGuild: () => true,
      inCachedGuild: () => true,
      inRawGuild: () => false,
      ...methods,
      _testState: this,
      ...this.interactionData,
    } as unknown as ChannelSelectMenuInteraction;

    return interaction;
  }

  /**
   * Build ModalSubmitInteraction
   */
  buildModalSubmit(): ModalSubmitInteraction {
    const mockUser = this.userData as User;
    const mockGuild = this.guildData as Guild;
    const mockChannel = this.channelData as Channel;
    const mockClient = this.clientData as Client;

    const mockMember = {
      id: mockUser.id,
      user: mockUser,
      guild: mockGuild,
      permissions: new PermissionsBitField([]),
      ...this.memberData,
    } as GuildMember;

    const methods = this.createMockMethods();

    const interaction = {
      type: InteractionType.ModalSubmit,
      customId: this.componentCustomId || 'test-modal',
      id: '123456789012345678',
      token: 'mock-token',
      applicationId: mockClient.application?.id || '111222333444555666',
      user: mockUser,
      guild: mockGuild,
      member: mockMember,
      channel: mockChannel,
      client: mockClient,
      createdTimestamp: Date.now(),
      fields: {
        getTextInputValue: jest.fn((customId: string) => this.modalFieldsData[customId] || ''),
      },
      isChatInputCommand: () => false,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isChannelSelectMenu: () => false,
      isRoleSelectMenu: () => false,
      isUserSelectMenu: () => false,
      isMentionableSelectMenu: () => false,
      isModalSubmit: () => true,
      isRepliable: () => true,
      inGuild: () => true,
      inCachedGuild: () => true,
      inRawGuild: () => false,
      ...methods,
      _testState: this,
      ...this.interactionData,
    } as unknown as ModalSubmitInteraction;

    return interaction;
  }

  /**
   * Auto-build based on type hints or default to ChatInput
   */
  build(): T {
    if (this.componentCustomId && Object.keys(this.modalFieldsData).length > 0) {
      return this.buildModalSubmit() as T;
    } else if (this.componentCustomId && this.expectedType === 'channel') {
      return this.buildChannelSelectMenu() as T;
    } else if (this.componentCustomId && this.selectValues.length > 0) {
      return this.buildStringSelectMenu() as T;
    } else if (this.componentCustomId) {
      return this.buildButton() as T;
    } else {
      return this.buildChatInput() as T;
    }
  }
}

// Convenience factory functions
export function createChatInputInteraction(commandName?: string): InteractionBuilder<ChatInputCommandInteraction> {
  const builder = new InteractionBuilder<ChatInputCommandInteraction>();
  if (commandName) {
    builder.command(commandName);
  }
  return builder;
}

export function createButtonInteraction(customId?: string): InteractionBuilder<ButtonInteraction> {
  const builder = new InteractionBuilder<ButtonInteraction>();
  if (customId) {
    builder.customId(customId);
  }
  return builder;
}

export function createStringSelectMenuInteraction(customId?: string, values?: string[]): InteractionBuilder<StringSelectMenuInteraction> {
  const builder = new InteractionBuilder<StringSelectMenuInteraction>();
  if (customId) {
    builder.customId(customId);
  }
  if (values) {
    builder.values(values);
  }
  return builder;
}

export function createChannelSelectMenuInteraction(customId?: string, values?: string[]): InteractionBuilder<ChannelSelectMenuInteraction> {
  const builder = new InteractionBuilder<ChannelSelectMenuInteraction>();
  builder.setType('channel');
  if (customId) {
    builder.customId(customId);
  }
  if (values) {
    builder.values(values);
  }
  return builder;
}

export function createModalSubmitInteraction(customId?: string, fields?: { [key: string]: string }): InteractionBuilder<ModalSubmitInteraction> {
  const builder = new InteractionBuilder<ModalSubmitInteraction>();
  if (customId) {
    builder.customId(customId);
  }
  if (fields) {
    builder.modalFields(fields);
  }
  return builder;
}