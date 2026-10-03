/**
 * Unit tests for canvasEmojiText — emoji w tekście na canvasie rysowane jako Twemoji,
 * bo node-canvas zamiast glifu emoji rysuje prostokąt z kodem (np. „01F3AE").
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockLoadImage = jest.fn();
jest.mock('canvas', () => ({ loadImage: (...args: unknown[]) => mockLoadImage(...args) }));

import {
  fillTextWithEmojiTracked,
  isEmojiGrapheme,
  splitGraphemes,
  twemojiCode,
} from '../../../src/utils/canvasEmojiText';

function fakeCtx() {
  return {
    textAlign: 'left',
    measureText: jest.fn(() => ({ width: 10 })),
    fillText: jest.fn(),
    drawImage: jest.fn(),
  };
}

beforeEach(() => mockLoadImage.mockReset());

describe('splitGraphemes / isEmojiGrapheme', () => {
  it('keeps multi-codepoint emoji in one piece', () => {
    expect(splitGraphemes('🎮A👨‍👩‍👧')).toEqual(['🎮', 'A', '👨‍👩‍👧']);
  });

  it('detects emoji but not letters, digits or Polish characters', () => {
    expect(isEmojiGrapheme('🎮')).toBe(true);
    expect(isEmojiGrapheme('🇵🇱')).toBe(true);
    expect(isEmojiGrapheme('A')).toBe(false);
    expect(isEmojiGrapheme('Ż')).toBe(false);
    expect(isEmojiGrapheme('7')).toBe(false);
  });
});

describe('twemojiCode', () => {
  it('builds Twemoji file names the way the Twemoji library does', () => {
    expect(twemojiCode('🎮')).toBe('1f3ae');
    expect(twemojiCode('❤️')).toBe('2764'); // FE0F dropped outside ZWJ sequences
    expect(twemojiCode('🇵🇱')).toBe('1f1f5-1f1f1');
    expect(twemojiCode('👨‍👩‍👧')).toBe('1f468-200d-1f469-200d-1f467');
  });
});

describe('fillTextWithEmojiTracked', () => {
  it('draws emoji as images and letters as text', async () => {
    const image = { width: 72, height: 72 };
    mockLoadImage.mockResolvedValue(image);
    const ctx = fakeCtx();

    await fillTextWithEmojiTracked(ctx as never, '🎮AB🎮', 0, 20, { fontSize: 10, letterSpacing: 2 });

    expect(mockLoadImage).toHaveBeenCalledWith(expect.stringContaining('/1f3ae.png'));
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.fillText.mock.calls.map(([ch]) => ch)).toEqual(['A', 'B']);
  });

  it('skips an emoji whose image cannot be loaded instead of drawing a code box', async () => {
    mockLoadImage.mockRejectedValue(new Error('offline'));
    const ctx = fakeCtx();

    const width = await fillTextWithEmojiTracked(ctx as never, '🦄X', 0, 20, { fontSize: 10, letterSpacing: 2 });

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText.mock.calls.map(([ch]) => ch)).toEqual(['X']);
    expect(width).toBe(10);
  });
});
