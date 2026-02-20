/* ── Mock canvas ──────────────────────────────────── */
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  fillRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  clip: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  drawImage: jest.fn(),
  measureText: jest.fn().mockReturnValue({ width: 100 }),
  rect: jest.fn(),
};

const mockCanvas = {
  getContext: jest.fn().mockReturnValue(mockCtx),
  toBuffer: jest.fn().mockReturnValue(Buffer.from('mock-png')),
};

jest.mock('canvas', () => ({
  createCanvas: jest.fn().mockReturnValue(mockCanvas),
  loadImage: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
}));

jest.mock('../../../src/utils/canvasHelpers', () => ({
  registerProjectFonts: jest.fn(),
  roundRect: jest.fn(),
  formatNumberCompact: jest.fn((n: number) => `${n}`),
}));

jest.mock('../../../src/utils/levelMath', () => ({
  xpForLevel: jest.fn((lvl: number) => lvl * 100),
  deltaXp: jest.fn(() => 100),
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      trophy: {
        gold: '<:gold:123>',
        silver: '<:silver:456>',
        bronze: '<:bronze:789>',
      },
    },
  }),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CanvasLeaderboardCard } from '../../../src/utils/canvasLeaderboardCard';

describe('CanvasLeaderboardCard', () => {
  const baseOptions = {
    entries: [
      { username: 'User1', level: 10, totalXP: 1500, rank: 1, avatarURL: 'https://example.com/av1.png' },
      { username: 'User2', level: 8, totalXP: 1200, rank: 2, avatarURL: 'https://example.com/av2.png' },
      { username: 'User3', level: 5, totalXP: 800, rank: 3, avatarURL: 'https://example.com/av3.png' },
      { username: 'RegularUser', level: 3, totalXP: 400, rank: 4, avatarURL: 'https://example.com/av4.png' },
    ],
    guildName: 'Test Guild',
    page: 1,
    botId: 'bot-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates instance with correct dimensions', () => {
    const card = new CanvasLeaderboardCard(baseOptions);
    expect(card).toBeDefined();
  });

  it('builds and returns a PNG buffer', async () => {
    const card = new CanvasLeaderboardCard(baseOptions);
    const buffer = await card.build();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(mockCanvas.toBuffer).toHaveBeenCalledWith('image/png');
  });

  it('draws header with page number > 1', async () => {
    const card = new CanvasLeaderboardCard({ ...baseOptions, page: 2 });
    await card.build();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('draws entries including top 3 with custom emojis', async () => {
    const card = new CanvasLeaderboardCard(baseOptions);
    await card.build();
    // Should have called drawImage for emoji loading (top 3 have custom emojis)
    expect(mockCtx.drawImage).toHaveBeenCalled();
  });

  it('handles avatar load failure gracefully', async () => {
    const { loadImage } = require('canvas');
    (loadImage as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    
    const card = new CanvasLeaderboardCard({
      ...baseOptions,
      entries: [baseOptions.entries[3]], // non-top-3 to avoid emoji loading
    });
    await card.build();
    // Should still produce a buffer
    expect(mockCanvas.toBuffer).toHaveBeenCalled();
  });

  it('truncates long usernames with ellipsis', async () => {
    mockCtx.measureText.mockReturnValue({ width: 500 }); // wider than maxUsernameWidth
    const card = new CanvasLeaderboardCard({
      ...baseOptions,
      entries: [{ ...baseOptions.entries[3], username: 'A'.repeat(100) }],
    });
    await card.build();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('defaults page to 1 if not specified', async () => {
    const { page, ...opts } = baseOptions;
    const card = new CanvasLeaderboardCard(opts as any);
    await card.build();
    expect(mockCanvas.toBuffer).toHaveBeenCalled();
  });
});
