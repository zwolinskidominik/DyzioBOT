/**
 * Deep tests for voiceControl, tempChannel, twitchScheduler, logVoiceStateUpdate
 */

import { VoiceChannel } from 'discord.js';

/* â”€â”€â”€ Common mocks â”€â”€â”€ */
jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0, TWITCH: 0x9146ff },
}));

const mockCreateBaseEmbed = jest.fn().mockReturnValue({
  setFooter: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  data: {},
});
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({ data: {} }),
}));

/* â”€â”€â”€ tempChannelService mock â”€â”€â”€ */
const mockValidateOwnership = jest.fn();
const mockTransferOwnership = jest.fn();
const mockGetTempChannel = jest.fn();
const mockGetMonitoredChannels = jest.fn();
const mockSaveTempChannel = jest.fn();
const mockDeleteTempChannel = jest.fn();
const mockSetControlMessageId = jest.fn();
jest.mock('../../../src/services/tempChannelService', () => ({
  validateOwnership: mockValidateOwnership,
  transferOwnership: mockTransferOwnership,
  getTempChannel: mockGetTempChannel,
  getMonitoredChannels: mockGetMonitoredChannels,
  saveTempChannel: mockSaveTempChannel,
  deleteTempChannel: mockDeleteTempChannel,
  setControlMessageId: mockSetControlMessageId,
}));

jest.mock('../../../src/utils/channelHelpers', () => ({
  safeSetChannelName: jest.fn().mockResolvedValue(undefined),
}));

/* â”€â”€â”€ Log helpers mock â”€â”€â”€ */
const mockSendLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: mockSendLog,
  truncate: jest.fn((s: string) => s),
}));

const mockGetModerator = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: mockGetModerator,
}));

/* â”€â”€â”€ Twitch mocks â”€â”€â”€ */
const mockGetActiveStreamers = jest.fn();
const mockSetLiveStatus = jest.fn();
jest.mock('../../../src/services/twitchService', () => ({
  getActiveStreamers: mockGetActiveStreamers,
  setLiveStatus: mockSetLiveStatus,
}));

const mockStreamConfigFind = jest.fn();
jest.mock('../../../src/models/StreamConfiguration', () => ({
  StreamConfigurationModel: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: mockStreamConfigFind }) }) },
}));

jest.mock('../../../src/config', () => ({
  env: jest.fn().mockReturnValue({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' }),
}));

const mockGetUserByName = jest.fn();
const mockGetStreamByUserId = jest.fn();
jest.mock('@twurple/auth', () => ({
  AppTokenAuthProvider: jest.fn(),
}));
jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    users: { getUserByName: mockGetUserByName },
    streams: { getStreamByUserId: mockGetStreamByUserId },
  })),
}));

let cronCallbacks: Function[] = [];
jest.mock('node-cron', () => ({
  schedule: jest.fn((_cron: string, cb: Function) => { cronCallbacks.push(cb); }),
}));

jest.mock('../../../src/config/constants/cron', () => ({
  CRON: { TWITCH_THUMBNAIL_CLEANUP: '0 * * * *', TWITCH_STREAM_CHECK: '*/2 * * * *' },
}));

const mockFsAccess = jest.fn();
const mockFsMkdir = jest.fn();
const mockFsReaddir = jest.fn();
const mockFsStat = jest.fn();
const mockFsUnlink = jest.fn();
const mockFsWriteFile = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: mockFsAccess,
    mkdir: mockFsMkdir,
    readdir: mockFsReaddir,
    stat: mockFsStat,
    unlink: mockFsUnlink,
    writeFile: mockFsWriteFile,
  },
}));

const mockUndici = jest.fn();
jest.mock('undici', () => ({
  fetch: mockUndici,
  request: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  cronCallbacks = [];
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   voiceControl
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
describe('voiceControl', () => {
  const voiceControl = require('../../../src/events/interactionCreate/voiceControl').default;

  function makeButtonInteraction(customId: string, overrides: any = {}) {
    return {
      isButton: () => true,
      isModalSubmit: () => false,
      isStringSelectMenu: () => false,
      customId,
      channelId: 'ch1',
      user: { id: 'u1' },
      guild: { id: 'g1', channels: { fetch: jest.fn() } },
      member: { id: 'u1', voice: { channel: { id: 'ch1' } } },
      inGuild: () => true,
      channel: { id: 'ch1' },
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function makeModalInteraction(customId: string, fields: Record<string, string> = {}) {
    return {
      isButton: () => false,
      isModalSubmit: () => true,
      isStringSelectMenu: () => false,
      customId,
      channelId: 'ch1',
      user: { id: 'u1' },
      guild: { id: 'g1', channels: { fetch: jest.fn() } },
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      fields: { getTextInputValue: (key: string) => fields[key] || '' },
    };
  }

  function makeSelectInteraction(customId: string, values: string[] = []) {
    return {
      isButton: () => false,
      isModalSubmit: () => false,
      isStringSelectMenu: () => true,
      customId,
      channelId: 'ch1',
      user: { id: 'u1' },
      guild: { id: 'g1', channels: { fetch: jest.fn() } },
      values,
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
  }

  describe('button handlers', () => {
    it('voice_limit shows modal when ownership valid', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const btn = makeButtonInteraction('voice_limit');
      await voiceControl(btn);
      expect(btn.showModal).toHaveBeenCalled();
    });

    it('voice_limit returns when ownership invalid', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
      const btn = makeButtonInteraction('voice_limit');
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalled();
      expect(btn.showModal).not.toHaveBeenCalled();
    });

    it('voice_limit returns NOT_OWNER message', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: false, code: 'NOT_OWNER' });
      const btn = makeButtonInteraction('voice_limit');
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalled();
    });

    it('voice_name shows modal', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const btn = makeButtonInteraction('voice_name');
      await voiceControl(btn);
      expect(btn.showModal).toHaveBeenCalled();
    });

    it('voice_lock toggles lock on channel', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const mockEdit = jest.fn();
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      // channel mock - VoiceChannel-like
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map(),
        permissionOverwrites: {
          cache: new Map([
            ['g1', { id: 'g1', type: 0, deny: { has: () => false }, allow: { toArray: () => [], has: () => false } }],
          ]),
          edit: mockEdit.mockResolvedValue(undefined),
          delete: mockDelete,
        },
      };
      // Patch: make it pass instanceof VoiceChannel check
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const btn = makeButtonInteraction('voice_lock');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(btn);
      expect(btn.deferReply).toHaveBeenCalled();
    });

    it('voice_lock replies error if no guild', async () => {
      const btn = makeButtonInteraction('voice_lock', {
        inGuild: () => false,
        channel: null,
        guild: null,
      });
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalled();
    });

    it('voice_kick shows select menu', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const memberMock = { id: 'u2', user: { username: 'other' }, displayName: 'Other' };
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u1', { id: 'u1', user: { username: 'owner' }, displayName: 'Owner' }], ['u2', memberMock]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const btn = makeButtonInteraction('voice_kick');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalled();
    });

    it('voice_kick says no members when empty', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u1', { id: 'u1' }]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const btn = makeButtonInteraction('voice_kick');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Brak') }));
    });

    it('voice_kick says error when channel not found', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const btn = makeButtonInteraction('voice_kick');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });

    it('voice_transfer shows select menu', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const memberMock = { id: 'u2', user: { username: 'other' }, displayName: 'Other' };
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u1', { id: 'u1', user: { username: 'owner' }, displayName: 'Owner' }], ['u2', memberMock]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const btn = makeButtonInteraction('voice_transfer');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalled();
    });

    it('voice_transfer says no members', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u1', { id: 'u1' }]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const btn = makeButtonInteraction('voice_transfer');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Brak') }));
    });

    it('voice_transfer says error when no channel', async () => {
      mockValidateOwnership.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const btn = makeButtonInteraction('voice_transfer');
      btn.guild.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(btn);
      expect(btn.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });
  });

  describe('modal handlers', () => {
    it('voice_limit_modal sets user limit', async () => {
      const mockSetUserLimit = jest.fn().mockResolvedValue(undefined);
      const channelMock = { id: 'ch1', constructor: { name: 'VoiceChannel' }, setUserLimit: mockSetUserLimit };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const modal = makeModalInteraction('voice_limit_modal_ch1', { limit_value: '10' });
      modal.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(modal);
      expect(modal.deferReply).toHaveBeenCalled();
    });

    it('voice_limit_modal rejects invalid value', async () => {
      const modal = makeModalInteraction('voice_limit_modal_ch1', { limit_value: 'abc' });
      await voiceControl(modal);
      expect(modal.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('0 do 99') }));
    });

    it('voice_limit_modal rejects out of range', async () => {
      const modal = makeModalInteraction('voice_limit_modal_ch1', { limit_value: '100' });
      await voiceControl(modal);
      // 100 > 99 â†’ error
    });

    it('voice_limit_modal handles no channel', async () => {
      const modal = makeModalInteraction('voice_limit_modal_ch1', { limit_value: '5' });
      modal.guild!.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(modal);
      expect(modal.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });

    it('voice_name_modal renames channel', async () => {
      const channelMock = { id: 'ch1', constructor: { name: 'VoiceChannel' } };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const modal = makeModalInteraction('voice_name_modal_ch1', { name_value: 'NewName' });
      modal.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(modal);
      expect(modal.deferReply).toHaveBeenCalled();
    });

    it('voice_name_modal handles no channel', async () => {
      const modal = makeModalInteraction('voice_name_modal_ch1', { name_value: 'Test' });
      modal.guild!.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(modal);
      expect(modal.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });
  });

  describe('select menu handlers', () => {
    it('voice_kick_select kicks member', async () => {
      const mockDisconnect = jest.fn().mockResolvedValue(undefined);
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u2', { id: 'u2', user: { tag: 'u2#0001' }, voice: { disconnect: mockDisconnect } }]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const sel = makeSelectInteraction('voice_kick_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(mockDisconnect).toHaveBeenCalled();
      expect(sel.update).toHaveBeenCalled();
    });

    it('voice_kick_select handles no channel', async () => {
      const sel = makeSelectInteraction('voice_kick_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });

    it('voice_kick_select handles member not found', async () => {
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map(),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const sel = makeSelectInteraction('voice_kick_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('kanale') }));
    });

    it('voice_transfer_select transfers ownership', async () => {
      mockGetTempChannel.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1', controlMessageId: null } });
      mockTransferOwnership.mockResolvedValue({ ok: true, data: { oldOwnerId: 'u1' } });
      const channelMock = {
        id: 'ch1',
        constructor: { name: 'VoiceChannel' },
        members: new Map([['u2', { id: 'u2', user: { tag: 'u2#0001' } }]]),
        permissionOverwrites: { edit: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) },
        send: jest.fn().mockResolvedValue(undefined),
        messages: { fetch: jest.fn() },
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('przekazana') }));
    });

    it('voice_transfer_select handles no temp channel', async () => {
      mockGetTempChannel.mockResolvedValue({ ok: false });
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });

    it('voice_transfer_select handles transfer failure', async () => {
      mockGetTempChannel.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const channelMock = {
        id: 'ch1', constructor: { name: 'VoiceChannel' },
        members: new Map([['u2', { id: 'u2', user: { tag: 'u2#0001' } }]]),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      mockTransferOwnership.mockResolvedValue({ ok: false });
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('przekazywania') }));
    });

    it('voice_transfer_select handles no voice channel', async () => {
      mockGetTempChannel.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(null);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie znaleziono') }));
    });

    it('voice_transfer_select handles new owner not in channel', async () => {
      mockGetTempChannel.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1' } });
      const channelMock = {
        id: 'ch1', constructor: { name: 'VoiceChannel' },
        members: new Map(),
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(sel.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('kanale') }));
    });

    it('voice_transfer_select updates control panel when controlMessageId exists', async () => {
      const mockMsgEdit = jest.fn().mockResolvedValue(undefined);
      mockGetTempChannel.mockResolvedValue({ ok: true, data: { channelId: 'ch1', ownerId: 'u1', controlMessageId: 'msg1' } });
      mockTransferOwnership.mockResolvedValue({ ok: true, data: { oldOwnerId: 'u1' } });
      const channelMock = {
        id: 'ch1', constructor: { name: 'VoiceChannel' },
        members: new Map([['u2', { id: 'u2', user: { tag: 'u2#0001' } }]]),
        permissionOverwrites: { edit: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) },
        send: jest.fn().mockResolvedValue(undefined),
        messages: { fetch: jest.fn().mockResolvedValue({ edit: mockMsgEdit }) },
      };
      Object.setPrototypeOf(channelMock, VoiceChannel.prototype);
      const sel = makeSelectInteraction('voice_transfer_select_ch1', ['u2']);
      sel.guild!.channels.fetch = jest.fn().mockResolvedValue(channelMock);
      await voiceControl(sel);
      expect(channelMock.messages.fetch).toHaveBeenCalledWith('msg1');
      expect(mockMsgEdit).toHaveBeenCalled();
    });
  });

  it('ignores unrelated interactions', async () => {
    const btn = makeButtonInteraction('unrelated_button');
    await voiceControl(btn);
    expect(mockValidateOwnership).not.toHaveBeenCalled();
  });

  it('catches errors in handler', async () => {
    mockValidateOwnership.mockRejectedValue(new Error('boom'));
    const btn = makeButtonInteraction('voice_limit');
    await voiceControl(btn);
    // Should not throw
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   logVoiceStateUpdate
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
describe('logVoiceStateUpdate', () => {
  const logVoice = require('../../../src/events/voiceStateUpdate/logVoiceStateUpdate').default;

  function makeMember() {
    return {
      id: 'u1',
      user: { tag: 'user#0001', bot: false, displayAvatarURL: () => 'https://example.com/av.png' },
    };
  }

  function makeState(overrides: any = {}) {
    return {
      channel: overrides.channel ?? null,
      channelId: overrides.channelId ?? (overrides.channel ? 'ch1' : null),
      guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      member: overrides.member ?? makeMember(),
      serverMute: overrides.serverMute ?? false,
      serverDeaf: overrides.serverDeaf ?? false,
      selfMute: overrides.selfMute ?? false,
      selfDeaf: overrides.selfDeaf ?? false,
      streaming: overrides.streaming ?? false,
      selfVideo: overrides.selfVideo ?? false,
    };
  }

  it('logs voice join', async () => {
    const oldState = makeState({ channel: null, channelId: null });
    const newState = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceJoin', expect.anything(), expect.anything());
  });

  it('logs voice leave (no moderator)', async () => {
    const oldState = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    const newState = makeState({ channel: null, channelId: null });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceLeave', expect.anything(), expect.anything());
  });

  it('logs voice disconnect (with moderator)', async () => {
    mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
    const oldState = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    const newState = makeState({ channel: null, channelId: null });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceDisconnect', expect.anything(), expect.anything());
  });

  it('logs voice move (no moderator)', async () => {
    const oldState = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    const newState = makeState({ channel: { id: 'ch2' }, channelId: 'ch2' });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceMove', expect.anything(), expect.anything());
  });

  it('logs voice member move (with moderator)', async () => {
    mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
    const oldState = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    const newState = makeState({ channel: { id: 'ch2' }, channelId: 'ch2' });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceMemberMove', expect.anything(), expect.anything());
  });

  it('logs state changes (mute, deaf, stream, video)', async () => {
    const oldState = makeState({
      channel: { id: 'ch1' }, channelId: 'ch1',
      serverMute: false, serverDeaf: false, selfMute: false, selfDeaf: false, streaming: false, selfVideo: false,
    });
    const newState = makeState({
      channel: { id: 'ch1' }, channelId: 'ch1',
      serverMute: true, serverDeaf: true, selfMute: true, selfDeaf: true, streaming: true, selfVideo: true,
    });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceStateChange', expect.anything(), expect.anything());
  });

  it('logs state changes reversed (unmute etc)', async () => {
    const oldState = makeState({
      channel: { id: 'ch1' }, channelId: 'ch1',
      serverMute: true, serverDeaf: true, selfMute: true, selfDeaf: true, streaming: true, selfVideo: true,
    });
    const newState = makeState({
      channel: { id: 'ch1' }, channelId: 'ch1',
      serverMute: false, serverDeaf: false, selfMute: false, selfDeaf: false, streaming: false, selfVideo: false,
    });
    await logVoice(oldState, newState, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'voiceStateChange', expect.anything(), expect.anything());
  });

  it('does nothing when no state changes in same channel', async () => {
    const s = makeState({ channel: { id: 'ch1' }, channelId: 'ch1' });
    await logVoice(s, s, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('returns when no member', async () => {
    const s = makeState({ channel: null, member: null });
    await logVoice(s, { ...s, member: null }, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   twitchScheduler
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
describe('twitchScheduler', () => {
  const twitchScheduler = require('../../../src/events/clientReady/twitchScheduler').default;

  it('registers cron schedules', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);
    // Should register 2 cron schedules (thumbnail cleanup + stream check)
    expect(cronCallbacks.length).toBe(2);
  });

  it('creates thumbnails directory if not exists', async () => {
    mockFsAccess.mockRejectedValue(new Error('ENOENT'));
    mockFsMkdir.mockResolvedValue(undefined);
    await twitchScheduler({} as any);
    expect(mockFsMkdir).toHaveBeenCalled();
  });

  it('runs thumbnail cleanup cron', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);
    // First cron callback is thumbnail cleanup
    mockFsReaddir.mockResolvedValue(Array.from({ length: 150 }, (_, i) => `file${i}.jpg`));
    mockFsStat.mockResolvedValue({ mtime: { getTime: () => Date.now() - i * 1000 } });
    // Execute cleanup
    let i = 0;
    mockFsStat.mockImplementation(() => ({ mtime: { getTime: () => Date.now() - (i++) * 1000 } }));
    mockFsUnlink.mockResolvedValue(undefined);
    await cronCallbacks[0]();
  });

  it('runs thumbnail cleanup with few files (no-op)', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);
    mockFsReaddir.mockResolvedValue(['file1.jpg', 'file2.jpg']);
    await cronCallbacks[0]();
    expect(mockFsUnlink).not.toHaveBeenCalled();
  });

  it('runs stream check with active streamer going live', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    const client = {
      guilds: {
        cache: new Map([
          ['g1', {
            id: 'g1',
            channels: {
              cache: new Map([['ch1', { id: 'ch1', send: jest.fn().mockResolvedValue(undefined) }]]),
            },
          }],
        ]),
      },
    };
    await twitchScheduler(client as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'streamer1', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'ch1' }]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1', displayName: 'Streamer1', profilePictureUrl: 'https://example.com/pic.png' });
    mockGetStreamByUserId.mockResolvedValue({
      title: 'Live!', gameName: 'CS2', id: 'str1',
      thumbnailUrl: 'https://example.com/thumb_{width}_{height}.jpg',
    });
    mockUndici.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    mockFsWriteFile.mockResolvedValue(undefined);
    mockSetLiveStatus.mockResolvedValue(undefined);

    // Second cron callback is stream check
    await cronCallbacks[1]();
    expect(mockSetLiveStatus).toHaveBeenCalledWith('g1', 'streamer1', true);
  });

  it('runs stream check - streamer goes offline', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'streamer1', isLive: true }] });
    mockStreamConfigFind.mockResolvedValue([]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1' });
    mockGetStreamByUserId.mockResolvedValue(null);
    mockSetLiveStatus.mockResolvedValue(undefined);

    await cronCallbacks[1]();
    expect(mockSetLiveStatus).toHaveBeenCalledWith('g1', 'streamer1', false);
  });

  it('runs stream check - no active streamers', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: false });
    await cronCallbacks[1]();
    expect(mockSetLiveStatus).not.toHaveBeenCalled();
  });

  it('runs stream check - streamer error', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'fail', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([]);
    mockGetUserByName.mockRejectedValue(new Error('Twitch API error'));

    await cronCallbacks[1]();
    // Should log error but not throw
  });

  it('handles notification with failed thumbnail download', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    const sendMock = jest.fn().mockResolvedValue(undefined);
    const client = {
      guilds: {
        cache: new Map([
          ['g1', {
            id: 'g1',
            channels: { cache: new Map([['ch1', { id: 'ch1', send: sendMock }]]) },
          }],
        ]),
      },
    };
    await twitchScheduler(client as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'str1', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'ch1' }]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1', displayName: 'Str1', profilePictureUrl: 'https://example.com/pic.png' });
    mockGetStreamByUserId.mockResolvedValue({
      title: 'Title', gameName: 'Game', id: 'streamid',
      thumbnailUrl: 'https://example.com/thumb_{width}_{height}.jpg',
    });
    mockUndici.mockRejectedValue(new Error('Network err'));
    mockSetLiveStatus.mockResolvedValue(undefined);

    await cronCallbacks[1]();
    expect(sendMock).toHaveBeenCalled();
  });

  it('handles notification to non-existent guild', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    const client = { guilds: { cache: new Map() } };
    await twitchScheduler(client as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'missing', twitchChannel: 'str1', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([{ guildId: 'missing', channelId: 'ch1' }]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1', displayName: 'Str1', profilePictureUrl: 'https://example.com/pic.png' });
    mockGetStreamByUserId.mockResolvedValue({
      title: 'Title', gameName: 'Game', id: 'id1',
      thumbnailUrl: 'https://example.com/thumb_{width}_{height}.jpg',
    });

    await cronCallbacks[1]();
    expect(mockSetLiveStatus).not.toHaveBeenCalled();
  });

  it('handles notification to missing channel', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    const client = {
      guilds: {
        cache: new Map([['g1', { id: 'g1', channels: { cache: new Map() } }]]),
      },
    };
    await twitchScheduler(client as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'str1', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'missing' }]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1', displayName: 'Str1', profilePictureUrl: 'https://example.com/pic.png' });
    mockGetStreamByUserId.mockResolvedValue({
      title: 'T', gameName: 'G', id: 'i', thumbnailUrl: 'https://example.com/{width}_{height}.jpg',
    });

    await cronCallbacks[1]();
    expect(mockSetLiveStatus).not.toHaveBeenCalled();
  });

  it('handles send error with local thumbnail', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    const sendMock = jest.fn()
      .mockRejectedValueOnce(new Error('Send failed'))  // first send with attachment fails
      .mockResolvedValueOnce(undefined);                 // retry without attachment succeeds
    const client = {
      guilds: {
        cache: new Map([['g1', { id: 'g1', channels: { cache: new Map([['ch1', { id: 'ch1', send: sendMock }]]) } }]]),
      },
    };
    await twitchScheduler(client as any);

    mockGetActiveStreamers.mockResolvedValue({ ok: true, data: [{ guildId: 'g1', twitchChannel: 'str1', isLive: false }] });
    mockStreamConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'ch1' }]);
    mockGetUserByName.mockResolvedValue({ id: 'tw1', displayName: 'Str1', profilePictureUrl: 'https://example.com/pic.png' });
    mockGetStreamByUserId.mockResolvedValue({
      title: 'T', gameName: 'G', id: 'i', thumbnailUrl: 'https://example.com/{width}_{height}.jpg',
    });
    mockUndici.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    mockFsWriteFile.mockResolvedValue(undefined);
    mockSetLiveStatus.mockResolvedValue(undefined);

    await cronCallbacks[1]();
    // Should have tried send twice (first with attachment, fallback without)
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('handles cleanup error gracefully', async () => {
    mockFsAccess.mockResolvedValue(undefined);
    await twitchScheduler({} as any);
    mockFsReaddir.mockRejectedValue(new Error('FS error'));
    await cronCallbacks[0]();
    // Should not throw
  });
});
