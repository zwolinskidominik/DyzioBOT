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
  fillTextWithEmoji,
  fillTextWithEmojiTracked,
  isEmojiGrapheme,
  splitGraphemes,
  twemojiCode,
} from '../../../src/utils/canvasEmojiText';

function fakeCtx() {
  return {
    textAlign: 'left',
    measureText: jest.fn((_text: string) => ({ width: 10 })),
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

describe('fillTextWithEmoji', () => {
  function measuringCtx() {
    const ctx = fakeCtx();
    ctx.measureText = jest.fn((text: string) => ({ width: [...text].length * 10 }));
    return ctx;
  }

  it('draws text between emoji as whole runs when there is no letter spacing (keeps kerning)', async () => {
    mockLoadImage.mockResolvedValue({ width: 72, height: 72 });
    const ctx = measuringCtx();

    const width = await fillTextWithEmoji(ctx as never, 'Blondi 🦋', 0, 20, { fontSize: 10 });

    expect(ctx.fillText.mock.calls.map(([text]) => text)).toEqual(['Blondi ']);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(width).toBe(70 + 12); // 7 znaków + emoji 1.2 × fontSize
  });

  it('truncates with an ellipsis to fit maxWidth', async () => {
    const ctx = measuringCtx();

    const width = await fillTextWithEmoji(ctx as never, 'Abcdefghij', 0, 20, { fontSize: 10, maxWidth: 50 });

    expect(ctx.fillText.mock.calls.map(([text]) => text)).toEqual(['Abcd…']);
    expect(width).toBe(50);
  });

  it('centers text around x', async () => {
    const ctx = measuringCtx();

    await fillTextWithEmoji(ctx as never, 'Abcd', 100, 20, { fontSize: 10, align: 'center' });

    expect(ctx.fillText).toHaveBeenCalledWith('Abcd', 80, 20);
  });
});
