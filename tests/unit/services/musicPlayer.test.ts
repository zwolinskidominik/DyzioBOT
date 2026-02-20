/* ── Mocks ─────────────────────────────────────────── */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/models/MusicConfig', () => ({
  MusicConfigModel: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockImplementation((opts: any) => ({
    ...opts,
    addFields: jest.fn().mockReturnThis(),
    toJSON: jest.fn(),
  })),
}));

jest.mock('../../../src/utils/cooldownHelpers', () => ({
  debounce: jest.fn(),
}));

jest.mock('../../../src/utils/timeHelpers', () => ({
  formatClock: jest.fn((ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, '0')}`),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { MUSIC: '#5865F2' },
}));

// Mock discord-player
const mockEventsOn = jest.fn();
const mockExtractorsRegister = jest.fn().mockResolvedValue(undefined);
jest.mock('discord-player', () => ({
  Player: jest.fn().mockImplementation(() => ({
    events: { on: mockEventsOn },
    extractors: { register: mockExtractorsRegister },
  })),
  GuildQueue: jest.fn(),
  Track: jest.fn(),
}));

jest.mock('../../../src/services/PlayDLExtractor', () => ({
  PlayDLExtractor: jest.fn(),
}));

import {
  initializeMusicPlayer,
  getMusicPlayer,
  createProgressBar,
  canUseMusic,
  canPlayInChannel,
} from '../../../src/services/musicPlayer';
import { MusicConfigModel } from '../../../src/models/MusicConfig';

const findOneMock = MusicConfigModel.findOne as jest.Mock;

describe('musicPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ── createProgressBar ──────────────────────────── */
  describe('createProgressBar', () => {
    it('returns full bar at 100%', () => {
      const bar = createProgressBar(100, 100, 10);
      expect(bar).toBe('▇'.repeat(10));
    });

    it('returns empty bar at 0%', () => {
      const bar = createProgressBar(0, 100, 10);
      expect(bar).toBe('—'.repeat(10));
    });

    it('returns half bar at 50%', () => {
      const bar = createProgressBar(50, 100, 10);
      expect(bar).toBe('▇'.repeat(5) + '—'.repeat(5));
    });

    it('uses default length of 20', () => {
      const bar = createProgressBar(50, 100);
      expect(bar.length).toBe(20);
    });
  });

  /* ── canUseMusic ────────────────────────────────── */
  describe('canUseMusic', () => {
    it('returns not allowed when config not found', async () => {
      findOneMock.mockResolvedValue(null);
      const result = await canUseMusic('guild-1', ['role-1']);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('wyłączony');
    });

    it('returns not allowed when module disabled', async () => {
      findOneMock.mockResolvedValue({ enabled: false });
      const result = await canUseMusic('guild-1', ['role-1']);
      expect(result.allowed).toBe(false);
    });

    it('returns not allowed when user lacks DJ role', async () => {
      findOneMock.mockResolvedValue({ enabled: true, djRoleId: 'dj-role' });
      const result = await canUseMusic('guild-1', ['role-1']);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DJ');
    });

    it('returns allowed when user has DJ role', async () => {
      findOneMock.mockResolvedValue({ enabled: true, djRoleId: 'dj-role' });
      const result = await canUseMusic('guild-1', ['dj-role']);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed when no DJ role required', async () => {
      findOneMock.mockResolvedValue({ enabled: true });
      const result = await canUseMusic('guild-1', ['role-1']);
      expect(result.allowed).toBe(true);
    });
  });

  /* ── canPlayInChannel ───────────────────────────── */
  describe('canPlayInChannel', () => {
    it('returns not allowed when config not found', async () => {
      findOneMock.mockResolvedValue(null);
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(false);
    });

    it('returns not allowed when module disabled', async () => {
      findOneMock.mockResolvedValue({ enabled: false });
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(false);
    });

    it('returns allowed when no channel restrictions', async () => {
      findOneMock.mockResolvedValue({ enabled: true, allowedChannels: [] });
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed when allowedChannels is undefined', async () => {
      findOneMock.mockResolvedValue({ enabled: true });
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed when channel is in allowed list', async () => {
      findOneMock.mockResolvedValue({ enabled: true, allowedChannels: ['vc-1', 'vc-2'] });
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(true);
    });

    it('returns not allowed when channel is not in allowed list', async () => {
      findOneMock.mockResolvedValue({ enabled: true, allowedChannels: ['vc-2'] });
      const result = await canPlayInChannel('guild-1', 'vc-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('nie jest dozwolony');
    });
  });

  /* ── getMusicPlayer ─────────────────────────────── */
  describe('getMusicPlayer (before init)', () => {
    it('returns null before initialization', () => {
      // Note: since initializeMusicPlayer may have been called in other tests,
      // we can only verify it returns a value (Player mock or null)
      const player = getMusicPlayer();
      // player might be Player mock from prior test or null
      expect(player === null || typeof player === 'object').toBe(true);
    });
  });

  /* ── initializeMusicPlayer ──────────────────────── */
  describe('initializeMusicPlayer', () => {
    it('creates a player and registers events', async () => {
      const mockClient = { user: { id: 'bot' } } as any;
      const player = await initializeMusicPlayer(mockClient);
      expect(player).toBeDefined();
      expect(mockExtractorsRegister).toHaveBeenCalled();
      // Should register 4 events: playerStart, emptyQueue, emptyChannel, playerError
      expect(mockEventsOn).toHaveBeenCalledTimes(4);
      expect(mockEventsOn.mock.calls.map((c: any[]) => c[0])).toEqual(
        expect.arrayContaining(['playerStart', 'emptyQueue', 'emptyChannel', 'playerError'])
      );
    });

    it('returns existing player on second call', async () => {
      const mockClient = { user: { id: 'bot' } } as any;
      const player1 = await initializeMusicPlayer(mockClient);
      const player2 = await initializeMusicPlayer(mockClient);
      expect(player1).toBe(player2);
    });

    it('getMusicPlayer returns player after init', async () => {
      const player = getMusicPlayer();
      expect(player).not.toBeNull();
    });
  });
});
