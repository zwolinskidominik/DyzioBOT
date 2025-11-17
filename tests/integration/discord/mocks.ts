import { EventEmitter } from 'events';
import {
  Client,
  Guild,
  User,
  GuildMember,
  TextChannel,
  VoiceChannel,
  Collection,
  ChannelType,
  GuildMemberRoleManager,
  UserManager,
  GuildManager,
  ChannelManager,
  Message,
  Interaction,
  PermissionResolvable,
  ClientEvents,
  BitField,
  PermissionsBitField
} from 'discord.js';

export class MockClient extends EventEmitter {
  public user: MockUser | null = null;
  public users: MockUserManager;
  public guilds: MockGuildManager;
  public channels: MockChannelManager;
  public readyAt: Date | null = null;
  public uptime: number | null = null;

  constructor() {
    super();
    this.users = new MockUserManager();
    this.guilds = new MockGuildManager();
    this.channels = new MockChannelManager();
  }

  login(token?: string): Promise<string> {
    this.user = new MockUser({
      id: '123456789012345678',
      username: 'TestBot',
      discriminator: '0000',
      bot: true
    });
    this.readyAt = new Date();
    this.uptime = 0;
    
    setImmediate(() => {
      this.emit('ready', this);
    });
    
    return Promise.resolve('mock-token');
  }

  destroy(): Promise<void> {
    this.readyAt = null;
    this.uptime = null;
    this.user = null;
    this.removeAllListeners();
    return Promise.resolve();
  }

  emitGuildMemberAdd(member: MockGuildMember): void {
    this.emit('guildMemberAdd', member);
  }

  emitGuildMemberRemove(member: MockGuildMember): void {
    this.emit('guildMemberRemove', member);
  }

  emitInteractionCreate(interaction: Interaction): void {
    this.emit('interactionCreate', interaction);
  }

  emitMessageCreate(message: MockMessage): void {
    this.emit('messageCreate', message);
  }

  emitVoiceStateUpdate(oldState: any, newState: any): void {
    this.emit('voiceStateUpdate', oldState, newState);
  }

  emitChannelDelete(channel: MockTextChannel | MockVoiceChannel): void {
    this.emit('channelDelete', channel);
  }

  emitGuildMemberUpdate(oldMember: MockGuildMember, newMember: MockGuildMember): void {
    this.emit('guildMemberUpdate', oldMember, newMember);
  }

  emitEvent<K extends keyof ClientEvents>(event: K, ...args: ClientEvents[K]): void {
    this.emit(event, ...args);
  }
}

export class MockUser {
  public id: string;
  public username: string;
  public discriminator: string;
  public bot: boolean;
  public avatar: string | null;
  public tag: string;
  public createdAt: Date;

  constructor(data: {
    id?: string;
    username?: string;
    discriminator?: string;
    bot?: boolean;
    avatar?: string | null;
  } = {}) {
    this.id = data.id || Math.random().toString().slice(2, 20);
    this.username = data.username || 'MockUser';
    this.discriminator = data.discriminator || '0001';
    this.bot = data.bot || false;
    this.avatar = data.avatar || null;
    this.tag = `${this.username}#${this.discriminator}`;
    this.createdAt = new Date();
  }

  toString(): string {
    return `<@${this.id}>`;
  }

  displayAvatarURL(options?: { format?: 'webp' | 'png' | 'jpg' | 'jpeg' | 'gif'; size?: number }): string {
    return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar || 'default'}.${options?.format || 'png'}`;
  }

  send(content: any): Promise<MockMessage> {
    return Promise.resolve(new MockMessage({
      content: typeof content === 'string' ? content : content.content,
      author: this
    }));
  }
}

export class MockGuild {
  public id: string;
  public name: string;
  public ownerId: string;
  public memberCount: number;
  public members: MockGuildMemberManager;
  public channels: MockGuildChannelManager;
  public roles: Collection<string, any>;
  public features: string[];
  public createdAt: Date;

  constructor(data: {
    id?: string;
    name?: string;
    ownerId?: string;
    memberCount?: number;
    features?: string[];
  } = {}) {
    this.id = data.id || Math.random().toString().slice(2, 20);
    this.name = data.name || 'Mock Guild';
    this.ownerId = data.ownerId || Math.random().toString().slice(2, 20);
    this.memberCount = data.memberCount || 1;
    this.features = data.features || [];
    this.createdAt = new Date();
    this.members = new MockGuildMemberManager(this);
    this.channels = new MockGuildChannelManager(this);
    this.roles = new Collection();
  }

  toString(): string {
    return this.name;
  }
}

export class MockGuildMember {
  public id: string;
  public user: MockUser;
  public guild: MockGuild;
  public nickname: string | null;
  public roles: MockGuildMemberRoleManager;
  public joinedAt: Date;
  public permissions: MockPermissionsBitField;
  public voice: {
    channel: MockVoiceChannel | null;
    mute: boolean;
    deaf: boolean;
  };

  constructor(data: {
    user?: MockUser;
    guild?: MockGuild;
    nickname?: string | null;
    joinedAt?: Date;
  } = {}) {
    this.user = data.user || new MockUser();
    this.id = this.user.id;
    this.guild = data.guild || new MockGuild();
    this.nickname = data.nickname || null;
    this.joinedAt = data.joinedAt || new Date();
    this.roles = new MockGuildMemberRoleManager();
    this.permissions = new MockPermissionsBitField();
    this.voice = {
      channel: null,
      mute: false,
      deaf: false
    };
  }

  get displayName(): string {
    return this.nickname || this.user.username;
  }

  toString(): string {
    return `<@${this.id}>`;
  }

  hasPermission(permission: PermissionResolvable): boolean {
    return this.permissions.has(permission);
  }

  kick(reason?: string): Promise<MockGuildMember> {
    return Promise.resolve(this);
  }

  ban(options?: { deleteMessageDays?: number; reason?: string }): Promise<MockGuildMember> {
    return Promise.resolve(this);
  }

  send(content: any): Promise<MockMessage> {
    return this.user.send(content);
  }
}

export class MockTextChannel {
  public id: string;
  public name: string;
  public type: ChannelType.GuildText;
  public guild: MockGuild;
  public topic: string | null;
  public nsfw: boolean;
  public position: number;
  public permissionOverwrites: Collection<string, any>;
  public createdAt: Date;

  constructor(data: {
    id?: string;
    name?: string;
    guild?: MockGuild;
    topic?: string | null;
    nsfw?: boolean;
    position?: number;
  } = {}) {
    this.id = data.id || Math.random().toString().slice(2, 20);
    this.name = data.name || 'mock-channel';
    this.type = ChannelType.GuildText;
    this.guild = data.guild || new MockGuild();
    this.topic = data.topic || null;
    this.nsfw = data.nsfw || false;
    this.position = data.position || 0;
    this.permissionOverwrites = new Collection();
    this.createdAt = new Date();
  }

  toString(): string {
    return `<#${this.id}>`;
  }

  send(content: any): Promise<MockMessage> {
    const message = new MockMessage({
      content: typeof content === 'string' ? content : (content.content || ''),
      channel: this,
      embeds: typeof content === 'object' ? content.embeds : undefined
    });
    return Promise.resolve(message);
  }

  bulkDelete(messages: number | any[]): Promise<Collection<string, MockMessage>> {
    const deleted = new Collection<string, MockMessage>();
    const count = typeof messages === 'number' ? messages : messages.length;
    for (let i = 0; i < count; i++) {
      const msg = new MockMessage({ channel: this });
      deleted.set(msg.id, msg);
    }
    return Promise.resolve(deleted);
  }

  createWebhook(options: { name: string; avatar?: string; reason?: string }): Promise<any> {
    return Promise.resolve({
      id: Math.random().toString().slice(2, 20),
      name: options.name,
      send: this.send.bind(this)
    });
  }

  setTopic(topic: string, reason?: string): Promise<MockTextChannel> {
    this.topic = topic;
    return Promise.resolve(this);
  }
}

export class MockVoiceChannel {
  public id: string;
  public name: string;
  public type: ChannelType.GuildVoice;
  public guild: MockGuild;
  public bitrate: number;
  public userLimit: number;
  public position: number;
  public permissionOverwrites: Collection<string, any>;
  public members: Collection<string, MockGuildMember>;
  public createdAt: Date;

  constructor(data: {
    id?: string;
    name?: string;
    guild?: MockGuild;
    bitrate?: number;
    userLimit?: number;
    position?: number;
  } = {}) {
    this.id = data.id || Math.random().toString().slice(2, 20);
    this.name = data.name || 'Mock Voice';
    this.type = ChannelType.GuildVoice;
    this.guild = data.guild || new MockGuild();
    this.bitrate = data.bitrate || 64000;
    this.userLimit = data.userLimit || 0;
    this.position = data.position || 0;
    this.permissionOverwrites = new Collection();
    this.members = new Collection();
    this.createdAt = new Date();
  }

  toString(): string {
    return `<#${this.id}>`;
  }

  setBitrate(bitrate: number, reason?: string): Promise<MockVoiceChannel> {
    this.bitrate = bitrate;
    return Promise.resolve(this);
  }

  setUserLimit(userLimit: number, reason?: string): Promise<MockVoiceChannel> {
    this.userLimit = userLimit;
    return Promise.resolve(this);
  }
}

export class MockMessage {
  public id: string;
  public content: string;
  public author: MockUser;
  public channel: MockTextChannel;
  public guild: MockGuild | null;
  public embeds: any[];
  public attachments: Collection<string, any>;
  public reactions: Collection<string, any>;
  public createdAt: Date;
  public editedAt: Date | null;

  constructor(data: {
    id?: string;
    content?: string;
    author?: MockUser;
    channel?: MockTextChannel;
    embeds?: any[];
  } = {}) {
    this.id = data.id || Math.random().toString().slice(2, 20);
    this.content = data.content || '';
    this.author = data.author || new MockUser();
    this.channel = data.channel || new MockTextChannel();
    this.guild = this.channel.guild;
    this.embeds = data.embeds || [];
    this.attachments = new Collection();
    this.reactions = new Collection();
    this.createdAt = new Date();
    this.editedAt = null;
  }

  reply(content: any): Promise<MockMessage> {
    return this.channel.send(content);
  }

  edit(content: any): Promise<MockMessage> {
    this.content = typeof content === 'string' ? content : content.content;
    this.editedAt = new Date();
    return Promise.resolve(this);
  }

  delete(): Promise<MockMessage> {
    return Promise.resolve(this);
  }

  react(emoji: string): Promise<any> {
    return Promise.resolve({
      emoji: { name: emoji },
      count: 1,
      remove: () => Promise.resolve()
    });
  }
}

export class MockUserManager {
  private cache = new Collection<string, MockUser>();

  fetch(id: string): Promise<MockUser> {
    let user = this.cache.get(id);
    if (!user) {
      user = new MockUser({ id });
      this.cache.set(id, user);
    }
    return Promise.resolve(user);
  }

  resolve(user: any): MockUser | null {
    if (typeof user === 'string') {
      return this.cache.get(user) || null;
    }
    return user instanceof MockUser ? user : null;
  }
}

export class MockGuildManager {
  private cache = new Collection<string, MockGuild>();

  fetch(id: string): Promise<MockGuild> {
    let guild = this.cache.get(id);
    if (!guild) {
      guild = new MockGuild({ id });
      this.cache.set(id, guild);
    }
    return Promise.resolve(guild);
  }

  resolve(guild: any): MockGuild | null {
    if (typeof guild === 'string') {
      return this.cache.get(guild) || null;
    }
    return guild instanceof MockGuild ? guild : null;
  }
}

export class MockChannelManager {
  private cache = new Collection<string, MockTextChannel | MockVoiceChannel>();

  fetch(id: string): Promise<MockTextChannel | MockVoiceChannel> {
    let channel = this.cache.get(id);
    if (!channel) {
      channel = new MockTextChannel({ id });
      this.cache.set(id, channel);
    }
    return Promise.resolve(channel);
  }

  resolve(channel: any): MockTextChannel | MockVoiceChannel | null {
    if (typeof channel === 'string') {
      return this.cache.get(channel) || null;
    }
    return channel instanceof MockTextChannel || channel instanceof MockVoiceChannel ? channel : null;
  }
}

export class MockGuildMemberManager {
  private cache = new Collection<string, MockGuildMember>();
  
  constructor(private guild: MockGuild) {}

  fetch(id: string): Promise<MockGuildMember> {
    let member = this.cache.get(id);
    if (!member) {
      const user = new MockUser({ id });
      member = new MockGuildMember({ user, guild: this.guild });
      this.cache.set(id, member);
    }
    return Promise.resolve(member);
  }

  resolve(member: any): MockGuildMember | null {
    if (typeof member === 'string') {
      return this.cache.get(member) || null;
    }
    return member instanceof MockGuildMember ? member : null;
  }
}

export class MockGuildChannelManager {
  private cache = new Collection<string, MockTextChannel | MockVoiceChannel>();
  
  constructor(private guild: MockGuild) {}

  create(options: {
    name: string;
    type?: ChannelType;
    topic?: string;
    bitrate?: number;
    userLimit?: number;
    position?: number;
    reason?: string;
  }): Promise<MockTextChannel | MockVoiceChannel> {
    const channel = options.type === ChannelType.GuildVoice
      ? new MockVoiceChannel({ 
          name: options.name, 
          guild: this.guild,
          bitrate: options.bitrate,
          userLimit: options.userLimit,
          position: options.position
        })
      : new MockTextChannel({ 
          name: options.name, 
          guild: this.guild,
          topic: options.topic,
          position: options.position
        });
    
    this.cache.set(channel.id, channel);
    return Promise.resolve(channel);
  }

  fetch(id: string): Promise<MockTextChannel | MockVoiceChannel> {
    const channel = this.cache.get(id);
    if (!channel) {
      throw new Error(`Channel ${id} not found`);
    }
    return Promise.resolve(channel);
  }
}

export class MockGuildMemberRoleManager {
  private roles = new Collection<string, any>();

  add(role: any, reason?: string): Promise<MockGuildMember> {
    const roleId = typeof role === 'string' ? role : role.id;
    this.roles.set(roleId, { id: roleId, name: `Role${roleId}` });
    return Promise.resolve({} as MockGuildMember);
  }

  remove(role: any, reason?: string): Promise<MockGuildMember> {
    const roleId = typeof role === 'string' ? role : role.id;
    this.roles.delete(roleId);
    return Promise.resolve({} as MockGuildMember);
  }

  has(role: any): boolean {
    const roleId = typeof role === 'string' ? role : role.id;
    return this.roles.has(roleId);
  }

  get cache(): Collection<string, any> {
    return this.roles;
  }
}

export class MockPermissionsBitField extends BitField<string, bigint> {
  constructor(bits?: any) {
    super(bits);
  }

  has(permission: PermissionResolvable, checkAdmin?: boolean): boolean {
    return true;
  }

  missing(permissions: PermissionResolvable[], checkAdmin?: boolean): string[] {
    return [];
  }
}

export const createMockClient = (options?: any): MockClient => {
  return new MockClient();
};

export const createMockGuild = (options?: any): MockGuild => {
  return new MockGuild(options);
};

export const createMockUser = (options?: any): MockUser => {
  return new MockUser(options);
};

export const createMockMember = (options?: any): MockGuildMember => {
  return new MockGuildMember(options);
};

export const createMockTextChannel = (options?: any): MockTextChannel => {
  return new MockTextChannel(options);
};

export const createMockVoiceChannel = (options?: any): MockVoiceChannel => {
  return new MockVoiceChannel(options);
};

export const createMockMessage = (options?: any): MockMessage => {
  return new MockMessage(options);
};

export type MockClientType = MockClient;
export type MockGuildType = MockGuild;
export type MockUserType = MockUser;
export type MockGuildMemberType = MockGuildMember;
export type MockTextChannelType = MockTextChannel;
export type MockVoiceChannelType = MockVoiceChannel;
export type MockMessageType = MockMessage;