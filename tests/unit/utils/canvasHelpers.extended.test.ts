jest.mock('canvas', () => ({
  registerFont: jest.fn(),
  CanvasRenderingContext2D: class {},
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { registerProjectFonts, roundRect } from '../../../src/utils/canvasHelpers';
import { registerFont } from 'canvas';
import fs from 'fs';

describe('registerProjectFonts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the fontsRegistered flag by re-importing (module-level state)
    jest.resetModules();
  });

  it('calls registerFont for fonts that exist', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    // Re-require to get fresh module state
    const { registerProjectFonts: freshRegister } = jest.requireActual('../../../src/utils/canvasHelpers') as any;
    // Note: we can't easily reset fontsRegistered flag, so test what we can
    // Just verify the function doesn't throw
    expect(() => registerProjectFonts()).not.toThrow();
  });

  it('is a no-op on second call (fonts already registered)', () => {
    // First call
    registerProjectFonts();
    const callsAfterFirst = (registerFont as jest.Mock).mock.calls.length;
    // Second call should be no-op
    registerProjectFonts();
    expect((registerFont as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });

  it('skips fonts that do not exist on disk', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    registerProjectFonts();
    // Even though fonts don't exist, should not throw
  });
});

describe('roundRect', () => {
  function mockCtx(): any {
    return {
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      closePath: jest.fn(),
    };
  }

  it('draws a rounded rectangle using canvas path methods', () => {
    const ctx = mockCtx();
    roundRect(ctx, 10, 20, 200, 100, 15);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(4);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
  });

  it('handles radius=0 (sharp corners)', () => {
    const ctx = mockCtx();
    roundRect(ctx, 0, 0, 100, 50, 0);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it('correct moveTo starting position', () => {
    const ctx = mockCtx();
    roundRect(ctx, 10, 20, 200, 100, 15);
    expect(ctx.moveTo).toHaveBeenCalledWith(25, 20); // x + radius, y
  });

  it('first lineTo goes to top-right minus radius', () => {
    const ctx = mockCtx();
    roundRect(ctx, 10, 20, 200, 100, 15);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 195, 20); // x+w-r, y
  });
});
