jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/models/ChannelStats', () => ({ ChannelStatsModel: { findOne: jest.fn() } }));

import { Collection } from 'discord.js';
import { updateBotServerCount } from '../../../src/utils/channelHelpers';
import { BOT_SERVER_COUNT_CHANNEL, SUPPORT_GUILD_ID } from '../../../src/config/constants/supportServer';

function makeClient(guildIds: string[], channel?: { name: string; setName: jest.Mock }) {
  const guilds = new Collection<string, unknown>();
  for (const id of guildIds) {
    const channels = new Collection<string, unknown>();
    if (id === SUPPORT_GUILD_ID && channel) channels.set(BOT_SERVER_COUNT_CHANNEL.channelId, { id: BOT_SERVER_COUNT_CHANNEL.channelId, ...channel });
    guilds.set(id, { id, channels: { cache: channels } });
  }
  return { guilds: { cache: guilds } };
}

describe('updateBotServerCount', () => {
  it('renames the support server counter to the number of servers the bot is in', async () => {
    const channel = { name: '🌐 Servers: 1', setName: jest.fn().mockResolvedValue(undefined) };
    await updateBotServerCount(makeClient([SUPPORT_GUILD_ID, 'g2', 'g3'], channel) as never);
    expect(channel.setName).toHaveBeenCalledWith('🌐 Servers: 3');
  });

  it('does not rename when the count did not change', async () => {
    const channel = { name: '🌐 Servers: 2', setName: jest.fn() };
    await updateBotServerCount(makeClient([SUPPORT_GUILD_ID, 'g2'], channel) as never);
    expect(channel.setName).not.toHaveBeenCalled();
  });

  it('does nothing when the bot is not on the support server (e.g. a dev instance)', async () => {
    await expect(updateBotServerCount(makeClient(['g2']) as never)).resolves.toBeUndefined();
  });
});
