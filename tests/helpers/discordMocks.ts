/**
 * Shared Discord.js mock factories for unit/integration tests.
 *
 * Usage:
 *   import { mockClient, mockInteraction, mockGuildMember, ... } from '../../helpers/discordMocks';
 */
import { Collection } from 'discord.js';

/* ── Helpers ──────────────────────────────────────────────── */

function collection<V>(entries: [string, V][] = []): Collection<string, V> {
  const c = new Collection<string, V>();
  for (const [k, v] of entries) c.set(k, v);
  return c;
}

/* ── Client ───────────────────────────────────────────────── */

export function mockClient(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'bot-id', tag: 'Bot#0001' },
    ws: { ping: 42 },
    guilds: {
      cache: collection(),
      fetch: jest.fn().mockResolvedValue(null),
    },
    application: {
      commands: {
        fetch: jest.fn().mockResolvedValue(collection()),
        create: jest.fn().mockResolvedValue({}),
        edit: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(collection()),
      },
    },
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    users: {
      cache: collection(),
      fetch: jest.fn().mockResolvedValue({ id: 'u1', username: 'TestUser', tag: 'TestUser#0001' }),
    },
    ...overrides,
  };
}

/* ── Guild ────────────────────────────────────────────────── */

export function mockGuild(overrides: Record<string, unknown> = {}): any {
  const guildId = (overrides.id as string) ?? 'guild-1';
  return {
    id: guildId,
    name: 'Test Guild',
    ownerId: 'owner-id',
    memberCount: 100,
    iconURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/icon.png'),
    members: {
      me: mockGuildMember({ id: 'bot-id', highestPos: 99 }),
      cache: collection(),
      fetch: jest.fn().mockImplementation(async (id: string) => mockGuildMember({ id })),
    },
    channels: {
      cache: collection(),
      fetch: jest.fn().mockResolvedValue(null),
    },
    bans: {
      cache: collection(),
      fetch: jest.fn().mockResolvedValue(collection()),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    roles: {
      cache: collection(),
    },
    emojis: {
      cache: collection(),
      create: jest.fn().mockResolvedValue({ id: 'e1', name: 'test_emoji' }),
    },
    fetchAuditLogs: jest.fn().mockResolvedValue({ entries: collection() }),
    commands: {
      fetch: jest.fn().mockResolvedValue(collection()),
      create: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(collection()),
      edit: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

/* ── GuildMember ──────────────────────────────────────────── */

export function mockGuildMember(
  opts: {
    id?: string;
    username?: string;
    highestPos?: number;
    guildOwnerId?: string;
    isBot?: boolean;
    premiumSince?: Date | null;
    communicationDisabledUntil?: Date | null;
    joinedTimestamp?: number;
  } = {},
): any {
  const id = opts.id ?? 'user-1';
  const username = opts.username ?? `User_${id}`;
  return {
    id,
    user: {
      id,
      username,
      tag: `${username}#0001`,
      bot: opts.isBot ?? false,
      displayAvatarURL: jest.fn().mockReturnValue(`https://cdn.discordapp.com/avatars/${id}.png`),
    },
    guild: { ownerId: opts.guildOwnerId ?? 'owner-id' },
    roles: {
      highest: { position: opts.highestPos ?? 5 },
      cache: collection(),
      add: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    displayName: username,
    premiumSince: opts.premiumSince ?? null,
    joinedTimestamp: opts.joinedTimestamp,
    isCommunicationDisabled: jest.fn().mockReturnValue(!!opts.communicationDisabledUntil),
    communicationDisabledUntil: opts.communicationDisabledUntil ?? null,
    timeout: jest.fn().mockResolvedValue(undefined),
    kick: jest.fn().mockResolvedValue(undefined),
    ban: jest.fn().mockResolvedValue(undefined),
    voice: {
      serverMute: false,
      serverDeaf: false,
      channelId: null,
    },
  };
}

/* ── User ─────────────────────────────────────────────────── */

export function mockUser(
  opts: { id?: string; username?: string; bot?: boolean } = {},
): any {
  const id = opts.id ?? 'user-1';
  const username = opts.username ?? `User_${id}`;
  return {
    id,
    username,
    tag: `${username}#0001`,
    bot: opts.bot ?? false,
    displayAvatarURL: jest.fn().mockReturnValue(`https://cdn.discordapp.com/avatars/${id}.png`),
  };
}

/* ── ChatInputCommandInteraction ─────────────────────────── */

export function mockInteraction(
  overrides: Record<string, unknown> = {},
): any {
  const guildObj = (overrides.guild as any) ?? mockGuild();
  const userObj = (overrides.user as any) ?? mockUser();
  const memberObj = (overrides.member as any) ?? mockGuildMember({ id: userObj.id });

  const optionValues: Record<string, unknown> = (overrides._options as Record<string, unknown>) ?? {};

  return {
    commandName: (overrides.commandName as string) ?? 'test',
    guildId: guildObj.id,
    guild: guildObj,
    user: userObj,
    member: memberObj,
    channel: (overrides.channel as any) ?? mockTextChannel(),
    channelId: ((overrides.channel as any)?.id as string) ?? 'ch-1',
    client: (overrides.client as any) ?? mockClient(),
    replied: false,
    deferred: false,
    memberPermissions: (overrides.memberPermissions as any) ?? {
      has: jest.fn().mockReturnValue(true),
    },
    options: {
      getUser: jest.fn().mockImplementation((name: string) => optionValues[name] ?? null),
      getString: jest.fn().mockImplementation((name: string, _req?: boolean) => optionValues[name] ?? null),
      getInteger: jest.fn().mockImplementation((name: string, _req?: boolean) => optionValues[name] ?? null),
      getSubcommand: jest.fn().mockReturnValue(optionValues._subcommand ?? null),
      getBoolean: jest.fn().mockImplementation((name: string) => optionValues[name] ?? null),
    },
    reply: jest.fn().mockResolvedValue({ id: 'reply-msg' }),
    editReply: jest.fn().mockResolvedValue({ id: 'edit-msg' }),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue({ id: 'followup-msg' }),
    fetchReply: jest.fn().mockResolvedValue({ createdTimestamp: Date.now() }),
    inGuild: jest.fn().mockReturnValue(true),
    isButton: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    isStringSelectMenu: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(true),
    isContextMenuCommand: jest.fn().mockReturnValue(false),
    isAutocomplete: jest.fn().mockReturnValue(false),
    showModal: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/* ── Button Interaction ──────────────────────────────────── */

export function mockButtonInteraction(
  overrides: Record<string, unknown> = {},
): any {
  return {
    ...mockInteraction(overrides),
    customId: (overrides.customId as string) ?? 'btn-test',
    isButton: jest.fn().mockReturnValue(true),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/* ── TextChannel ──────────────────────────────────────────── */

export function mockTextChannel(overrides: Record<string, unknown> = {}): any {
  return {
    id: (overrides.id as string) ?? 'ch-1',
    name: (overrides.name as string) ?? 'test-channel',
    type: 0,
    isTextBased: jest.fn().mockReturnValue(true),
    isVoiceBased: jest.fn().mockReturnValue(false),
    send: jest.fn().mockResolvedValue({ id: 'sent-msg' }),
    setName: jest.fn().mockResolvedValue(undefined),
    permissionOverwrites: { cache: collection() },
    ...overrides,
  };
}

/* ── VoiceChannel ─────────────────────────────────────────── */

export function mockVoiceChannel(overrides: Record<string, unknown> = {}): any {
  return {
    id: (overrides.id as string) ?? 'vc-1',
    name: (overrides.name as string) ?? 'Voice Channel',
    type: 2,
    isTextBased: jest.fn().mockReturnValue(false),
    isVoiceBased: jest.fn().mockReturnValue(true),
    members: (overrides.members as any) ?? collection(),
    setName: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    permissionOverwrites: {
      cache: collection(),
      create: jest.fn().mockResolvedValue(undefined),
      edit: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

/* ── VoiceState ───────────────────────────────────────────── */

export function mockVoiceState(overrides: Record<string, unknown> = {}): any {
  return {
    channelId: (overrides.channelId as string) ?? null,
    channel: overrides.channel ?? null,
    guild: (overrides.guild as any) ?? mockGuild(),
    member: (overrides.member as any) ?? mockGuildMember(),
    id: (overrides.id as string) ?? 'user-1',
    serverMute: false,
    serverDeaf: false,
    ...overrides,
  };
}

/* ── Message ──────────────────────────────────────────────── */

export function mockMessage(overrides: Record<string, unknown> = {}): any {
  return {
    id: (overrides.id as string) ?? 'msg-1',
    content: (overrides.content as string) ?? 'Hello',
    author: (overrides.author as any) ?? mockUser(),
    guild: (overrides.guild as any) ?? mockGuild(),
    guildId: ((overrides.guild as any)?.id as string) ?? 'guild-1',
    channel: (overrides.channel as any) ?? mockTextChannel(),
    channelId: ((overrides.channel as any)?.id as string) ?? 'ch-1',
    member: (overrides.member as any) ?? mockGuildMember(),
    reply: jest.fn().mockResolvedValue({ id: 'reply' }),
    delete: jest.fn().mockResolvedValue(undefined),
    attachments: collection(),
    embeds: [],
    partial: false,
    ...overrides,
  };
}

/* ── Role ──────────────────────────────────────────────────── */

export function mockRole(overrides: Record<string, unknown> = {}): any {
  const id = (overrides.id as string) ?? 'role-1';
  return {
    id,
    name: (overrides.name as string) ?? `Role_${id}`,
    color: (overrides.color as number) ?? 0x000000,
    position: (overrides.position as number) ?? 1,
    permissions: (overrides.permissions as any) ?? { has: jest.fn().mockReturnValue(false) },
    guild: (overrides.guild as any) ?? mockGuild(),
    ...overrides,
  };
}
