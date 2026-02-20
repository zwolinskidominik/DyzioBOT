/**
 * Tests for channel-related events:
 * - channelCreate/logChannelCreate
 * - channelDelete/deleteStatsChannel, deleteTempChannel, logChannelDelete
 * - channelUpdate/logChannelUpdate
 */

/* ── mocks ───────────────────────────────────────────────── */

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/channelHelpers', () => ({
  deleteStatsChannel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/tempChannelService', () => ({
  deleteTempChannelByChannelId: jest.fn().mockResolvedValue({ ok: true }),
}));

const mockFindOne = jest.fn().mockResolvedValue(null);
const mockFindOneAndUpdate = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/models/TempChannelConfiguration', () => ({
  TempChannelConfigurationModel: {
    findOne: (...args: any[]) => mockFindOne(...args),
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
  },
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { getModerator } from '../../../src/utils/auditLogHelpers';
import { mockClient, mockGuild, mockTextChannel } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* helper for permission overwrites collection */
function permCollection(entries: any[] = []) {
  const c = new Collection<string, any>();
  for (const e of entries) c.set(e.id, e);
  return c;
}

describe('channelCreate / logChannelCreate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelCreate/logChannelCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with channelCreate type', async () => {
    const client = mockClient();
    const channel = {
      id: 'ch-new',
      name: 'new-channel',
      type: 0,
      guild: mockGuild(),
      parentId: 'cat-1',
      permissionOverwrites: { cache: permCollection() },
    };
    await run(channel, client);
    expect(sendLog).toHaveBeenCalled();
  });
});

describe('channelDelete / logChannelDelete', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelDelete/logChannelDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with channelDelete', async () => {
    const client = mockClient();
    const channel = {
      id: 'ch-del',
      name: 'deleted-channel',
      type: 0,
      guild: mockGuild(),
      permissionOverwrites: { cache: permCollection() },
    };
    await run(channel, client);
    expect(sendLog).toHaveBeenCalled();
  });
});

describe('channelDelete / deleteStatsChannel', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelDelete/deleteStatsChannel')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('can be called without throwing', async () => {
    const channel = { id: 'ch-del', guild: mockGuild() };
    await expect(run(channel)).resolves.not.toThrow();
  });
});

describe('channelDelete / deleteTempChannel', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelDelete/deleteTempChannel')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls TempChannelConfigurationModel to check and remove', async () => {
    mockFindOne.mockResolvedValueOnce({ guildId: 'guild-1', channelIds: ['ch-del'] });
    const channel = { id: 'ch-del', guild: { id: 'guild-1' }, type: 2 };
    await run(channel);
    expect(mockFindOne).toHaveBeenCalledWith(expect.objectContaining({ channelIds: 'ch-del' }));
  });
});

describe('channelUpdate / logChannelUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelUpdate/logChannelUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs name change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldChannel = {
      id: 'ch-1', name: 'old-name', guild, type: 0,
      permissionOverwrites: { cache: permCollection() },
    };
    const newChannel = {
      id: 'ch-1', name: 'new-name', guild, type: 0,
      permissionOverwrites: { cache: permCollection() },
    };
    await run(oldChannel, newChannel, client);
    expect(sendLog).toHaveBeenCalled();
    const call = (sendLog as jest.Mock).mock.calls[0];
    expect(call[2]).toBe('channelUpdate');
  });

  it('logs topic change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const base = {
      id: 'ch-1', name: 'same', guild, type: 0,
      permissionOverwrites: { cache: permCollection() },
    };
    const oldChannel = { ...base, topic: 'old topic' };
    const newChannel = { ...base, topic: 'new topic' };
    await run(oldChannel, newChannel, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('does nothing when nothing changed', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const perms = permCollection();
    const ch = {
      id: 'ch-1', name: 'same', guild, type: 0,
      permissionOverwrites: { cache: perms },
    };
    await run(ch, ch, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('logs added permission overwrites', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldPerms = permCollection();
    const newPerms = permCollection([{
      id: 'role-1',
      type: 0, // Role
      allow: { toArray: () => ['SendMessages'] },
      deny: { toArray: () => [] },
    }]);
    guild.roles = { cache: new Collection([['role-1', { name: 'TestRole' }]]) };
    const oldChannel = {
      id: 'ch-1', name: 'same', guild, type: 0,
      permissionOverwrites: { cache: oldPerms },
    };
    const newChannel = {
      id: 'ch-1', name: 'same', guild, type: 0,
      permissionOverwrites: { cache: newPerms },
    };
    await run(oldChannel, newChannel, client);
    expect(sendLog).toHaveBeenCalled();
    const call = (sendLog as jest.Mock).mock.calls[0];
    expect(call[2]).toBe('channelPermissionUpdate');
  });
});
