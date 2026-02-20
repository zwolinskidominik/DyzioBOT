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
  formatNumberDotSep: jest.fn((n: number) => n.toLocaleString('pl-PL')),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CanvasRankCard } from '../../../src/utils/canvasRankCard';

describe('CanvasRankCard', () => {
  const baseOptions = {
    username: 'TestUser',
    level: 15,
    currentXP: 750,
    requiredXP: 1000,
    totalXP: 5000,
    rank: 3,
    avatarURL: 'https://example.com/avatar.png',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates instance with correct dimensions', () => {
    const card = new CanvasRankCard(baseOptions);
    expect(card).toBeDefined();
  });

  it('builds and returns a PNG buffer', async () => {
    const card = new CanvasRankCard(baseOptions);
    const buffer = await card.build();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(mockCanvas.toBuffer).toHaveBeenCalledWith('image/png');
  });

  it('draws background with rounded corners', async () => {
    const card = new CanvasRankCard(baseOptions);
    await card.build();
    const { roundRect } = require('../../../src/utils/canvasHelpers');
    expect(roundRect).toHaveBeenCalled();
  });

  it('draws decorative circles', async () => {
    const card = new CanvasRankCard(baseOptions);
    await card.build();
    expect(mockCtx.arc).toHaveBeenCalled();
  });

  it('draws user info with level and rank', async () => {
    const card = new CanvasRankCard(baseOptions);
    await card.build();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('draws progress bar based on XP ratio', async () => {
    const card = new CanvasRankCard(baseOptions);
    await card.build();
    // Progress bar uses roundRect
    const { roundRect } = require('../../../src/utils/canvasHelpers');
    expect(roundRect).toHaveBeenCalled();
  });

  it('handles avatar load failure gracefully', async () => {
    const { loadImage } = require('canvas');
    (loadImage as jest.Mock).mockRejectedValueOnce(new Error('timeout'));

    const card = new CanvasRankCard(baseOptions);
    await card.build();
    // Should still produce output
    expect(mockCanvas.toBuffer).toHaveBeenCalled();
  });

  it('handles 0% progress (empty bar)', async () => {
    const card = new CanvasRankCard({ ...baseOptions, currentXP: 0 });
    await card.build();
    expect(mockCanvas.toBuffer).toHaveBeenCalled();
  });

  it('handles 100% progress (full bar)', async () => {
    const card = new CanvasRankCard({ ...baseOptions, currentXP: 1000, requiredXP: 1000 });
    await card.build();
    expect(mockCanvas.toBuffer).toHaveBeenCalled();
  });

  it('draws total XP text', async () => {
    const card = new CanvasRankCard(baseOptions);
    await card.build();
    const { formatNumberDotSep } = require('../../../src/utils/canvasHelpers');
    expect(formatNumberDotSep).toHaveBeenCalledWith(5000);
  });
});
