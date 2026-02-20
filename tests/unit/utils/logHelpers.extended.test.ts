jest.mock('../../../src/models/LogConfiguration', () => ({
  LogConfigurationModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { LogConfigurationModel } from '../../../src/models/LogConfiguration';
import { Collection } from 'discord.js';

function leanReturns(data: any) {
  (LogConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => data });
}

const sendMock = jest.fn().mockResolvedValue(undefined);

function makeClient(opts: { guildExists?: boolean; channelExists?: boolean } = {}): any {
  const { guildExists = true, channelExists = true } = opts;
  const channel = channelExists ? { id: 'log-ch', send: sendMock } : undefined;
  const channels = new Collection<string, any>();
  if (channel) channels.set('log-ch', channel);
  const guild = guildExists ? { id: 'g1', channels: { cache: channels } } : undefined;
  const guilds = new Collection<string, any>();
  if (guild) guilds.set('g1', guild);
  return { guilds: { cache: guilds } };
}

describe('sendLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMock.mockClear();
  });

  it('returns early when no config exists', async () => {
    leanReturns(null);
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns early when event is not enabled', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: false },
      logChannels: { memberJoin: 'log-ch' },
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends log embed to configured channel', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'User joined' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.embeds).toHaveLength(1);
  });

  it('returns early when logChannel is not configured for event', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: {},
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns early when guild not found', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
    });
    await sendLog(makeClient({ guildExists: false }), 'g1', 'memberJoin', { description: 'test' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns early when channel not found', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
    });
    await sendLog(makeClient({ channelExists: false }), 'g1', 'memberJoin', { description: 'test' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips when context channel is ignored', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
      ignoredChannels: ['ch-ignored'],
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' }, { channelId: 'ch-ignored' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips when context user is ignored', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
      ignoredUsers: ['u-ignored'],
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' }, { userId: 'u-ignored' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips when context member has ignored role', async () => {
    const member = {
      roles: { cache: new Collection([['r-ignored', { id: 'r-ignored' }]]) },
    } as any;
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
      ignoredRoles: ['r-ignored'],
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' }, { member });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does not skip when context member has no ignored role', async () => {
    const member = {
      roles: { cache: new Collection([['r-ok', { id: 'r-ok' }]]) },
    } as any;
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
      ignoredRoles: ['r-ignored'],
    });
    await sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' }, { member });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('handles send error gracefully', async () => {
    leanReturns({
      guildId: 'g1',
      enabledEvents: { memberJoin: true },
      logChannels: { memberJoin: 'log-ch' },
    });
    sendMock.mockRejectedValue(new Error('send failed'));
    // Should not throw
    await expect(
      sendLog(makeClient(), 'g1', 'memberJoin', { description: 'test' }),
    ).resolves.toBeUndefined();
  });
});
