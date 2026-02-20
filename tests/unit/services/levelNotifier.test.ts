jest.mock('../../../src/models/LevelConfig', () => ({
  LevelConfigModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/services/rewardRoles', () => ({
  syncRewardRoles: jest.fn().mockResolvedValue({ gained: null }),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { notifyLevelUp } from '../../../src/services/levelNotifier';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { syncRewardRoles } from '../../../src/services/rewardRoles';
import { Collection } from 'discord.js';

/* ── helpers ─────────────────────────────────────────── */
const sendMock = jest.fn().mockResolvedValue(undefined);

function makeClient(opts: {
  guildExists?: boolean;
  memberInCache?: boolean;
  channelExists?: boolean;
} = {}): any {
  const { guildExists = true, memberInCache = true, channelExists = true } = opts;

  const member: any = {
    id: 'u1',
    roles: { cache: new Collection(), add: jest.fn(), remove: jest.fn() },
  };

  const channel: any = channelExists
    ? { id: 'ch1', send: sendMock }
    : undefined;

  const channels = new Collection<string, any>();
  if (channel) channels.set('ch1', channel);

  const members = new Collection<string, any>();
  if (memberInCache) members.set('u1', member);

  const guild: any = guildExists
    ? {
        id: 'g1',
        channels: { cache: channels },
        members: {
          cache: members,
          fetch: jest.fn().mockResolvedValue(member),
        },
      }
    : undefined;

  const guilds = new Collection<string, any>();
  if (guild) guilds.set('g1', guild);

  return { guilds: { cache: guilds } };
}

function cfgWith(overrides: Record<string, any> = {}) {
  return {
    guildId: 'g1',
    notifyChannelId: 'ch1',
    roleRewards: [
      { level: 5, roleId: 'r5', rewardMessage: undefined },
      { level: 10, roleId: 'r10', rewardMessage: 'Custom {user} lvl {level} {roleId}' },
    ],
    rewardMessage: undefined,
    ...overrides,
  };
}

/* ── tests ────────────────────────────────────────────── */
describe('notifyLevelUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMock.mockClear();
  });

  it('returns early if no config found', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({ lean: () => null });
    const c = makeClient();
    await notifyLevelUp(c, 'g1', 'u1', 5);
    expect(syncRewardRoles).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns early if config has no notifyChannelId', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith({ notifyChannelId: null }),
    });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 5);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns early if guild not in cache', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    await notifyLevelUp(makeClient({ guildExists: false }), 'g1', 'u1', 5);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('fetches member if not in cache', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    const client = makeClient({ memberInCache: false });
    const guild = client.guilds.cache.get('g1');
    await notifyLevelUp(client, 'g1', 'u1', 5);
    expect(guild.members.fetch).toHaveBeenCalledWith('u1');
    expect(syncRewardRoles).toHaveBeenCalled();
  });

  it('returns early if member fetch fails', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    const client = makeClient({ memberInCache: false });
    const guild = client.guilds.cache.get('g1');
    guild.members.fetch = jest.fn().mockRejectedValue(new Error('unknown'));
    await notifyLevelUp(client, 'g1', 'u1', 5);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('calls syncRewardRoles with member, level, and rewards', async () => {
    const cfg = cfgWith();
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({ lean: () => cfg });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 5);
    expect(syncRewardRoles).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      5,
      cfg.roleRewards,
    );
  });

  it('returns early when level has no matching rewardForLevel', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    // level 7 has no reward entry
    await notifyLevelUp(makeClient(), 'g1', 'u1', 7);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends default message template when no custom rewardMessage', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 5);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.content).toContain('<@u1>');
    expect(call.content).toContain('5');
    expect(call.content).toContain('<@&r5>');
  });

  it('sends custom rewardMessage from specific reward entry', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 10);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const content = sendMock.mock.calls[0][0].content;
    expect(content).toBe('Custom <@u1> lvl 10 <@&r10>');
  });

  it('returns early if notify channel not found', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    await notifyLevelUp(makeClient({ channelExists: false }), 'g1', 'u1', 5);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses cfg.rewardMessage as fallback when no per-reward message', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith({
        roleRewards: [{ level: 5, roleId: 'r5' }],
        rewardMessage: 'Fallback {user} {level} {roleId}',
      }),
    });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 5);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].content).toBe('Fallback <@u1> 5 <@&r5>');
  });

  it('sets allowedMentions correctly', async () => {
    (LevelConfigModel.findOne as jest.Mock).mockReturnValue({
      lean: () => cfgWith(),
    });
    await notifyLevelUp(makeClient(), 'g1', 'u1', 5);
    const call = sendMock.mock.calls[0][0];
    expect(call.allowedMentions).toEqual({ users: ['u1'], roles: [] });
  });
});
