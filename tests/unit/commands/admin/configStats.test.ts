export {};

import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ ...args, setTimestamp: jest.fn().mockReturnThis() })),
}));

const ChannelStatsModelMock: any = { findOne: jest.fn(), updateOne: jest.fn() };
jest.mock('../../../../src/models/ChannelStats', () => ({
  __esModule: true,
  ChannelStatsModel: ChannelStatsModelMock,
}));

const buildGuild = (over?: Partial<any>) => {
  const membersCache = new Map<string, any>();
  const guild = {
    id: 'g1',
    name: 'G',
    members: {
      cache: {
        filter: (fn: any) => {
          const arr = Array.from(membersCache.values()).filter((m) => fn(m));
          return { size: arr.length, first: () => arr[0], sort: (cmp: any) => ({ first: () => arr.sort(cmp)[0] }) };
        },
      },
    },
    bans: { fetch: jest.fn() },
    channels: {
      create: jest.fn(async ({ name, type, permissionOverwrites }: any) => ({ id: 'vc1', name, type, permissionOverwrites })),
    },
  } as any;
  membersCache.set('1', { id: '1', user: { bot: false, username: 'user1' }, joinedTimestamp: 1000 });
  membersCache.set('2', { id: '2', user: { bot: true, username: 'bot2' }, joinedTimestamp: 2000 });
  membersCache.set('3', { id: '3', user: { bot: false, username: 'user3' }, joinedTimestamp: 3000 });
  return { ...guild, ...over };
};

const buildInteraction = (over?: Partial<any>) => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getString: jest.fn((name: string, required?: boolean) => {
      if (name === 'rodzaj') return 'users';
      if (name === 'nazwa-kanalu') return '<> osób';
      return null;
    }),
  };
  const user = { tag: 'user#0001', displayAvatarURL: () => 'http://a' } as any;
  const guild = buildGuild();
  return { deferReply, editReply, options, user, guild, ...over } as any;
};

describe('admin/configStats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('walidacja braku placeholdera "<>"', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configStats');
      const interaction = buildInteraction({ options: { getString: jest.fn((name: string) => (name === 'rodzaj' ? 'users' : 'bez placeholdera')) } });
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/musi zawierać placeholder/i) }));
    });
  });

  test('users/bots liczby z cache', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configStats');
      const guild = buildGuild();
      const interaction = buildInteraction({ guild });
      (ChannelStatsModelMock.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      (ChannelStatsModelMock.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });
      interaction.options.getString = jest.fn((n: string) => (n === 'rodzaj' ? 'users' : '<> users'));
      await run({ interaction, client: {} as any });
      expect(guild.channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(/^\d+ users$/), type: ChannelType.GuildVoice }));
      interaction.options.getString = jest.fn((n: string) => (n === 'rodzaj' ? 'bots' : '<> bots'));
      await run({ interaction, client: {} as any });
      expect(guild.channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(/^\d+ bots$/), type: ChannelType.GuildVoice }));
      expect(ChannelStatsModelMock.updateOne).toHaveBeenCalledWith(
        { guildId: 'g1' },
        expect.any(Object),
        { upsert: true }
      );
    });
  });

  test('bans: fetch ok i fetch błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configStats');
      const guild = buildGuild();
      guild.bans.fetch.mockResolvedValue({ size: 5 });
      const interaction = buildInteraction({ guild });
      (ChannelStatsModelMock.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      (ChannelStatsModelMock.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });
      interaction.options.getString = jest.fn((n: string) => (n === 'rodzaj' ? 'bans' : 'bany: <>'));
      await run({ interaction, client: {} as any });
      expect(guild.channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'bany: 5' }));
      guild.bans.fetch.mockRejectedValue(new Error('boom'));
      await run({ interaction, client: {} as any });
      expect(guild.channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'bany: 0' }));
    });
  });

  test('lastJoined', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configStats');
      const guild = buildGuild();
      const interaction = buildInteraction({ guild });
      (ChannelStatsModelMock.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ channels: {} }) }) });
      (ChannelStatsModelMock.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });
      interaction.options.getString = jest.fn((n: string) => (n === 'rodzaj' ? 'lastJoined' : 'ostatni: <>'));
      await run({ interaction, client: {} as any });
      expect(guild.channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(/^ostatni: .+/) }));
      const updateArg = (ChannelStatsModelMock.updateOne as jest.Mock).mock.calls.pop()?.[1];
      expect(JSON.stringify(updateArg)).toEqual(expect.stringMatching(/"lastJoined"/));
    });
  });

  test('updateOne błąd → editReply + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../src/commands/admin/configStats');
      const guild = buildGuild();
      const interaction = buildInteraction({ guild });
      (ChannelStatsModelMock.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ channels: {} }) }) });
      (ChannelStatsModelMock.updateOne as jest.Mock).mockRejectedValue(new Error('db'));
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      if (typeof arg === 'string') {
        expect(arg).toMatch(/Wystąpił błąd/i);
      } else {
        expect(arg).toEqual(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd/i) }));
      }
    });
  });
});
