import { fetchRandomAnimalImage, handleAnimalError, createAnimalEmbed } from '../../../src/utils/animalHelpers';
import type { CommandInteraction } from 'discord.js';
import type { IAnimalCommandConfig } from '../../../src/interfaces/api/Animal';

jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));
const logger = require('../../../src/utils/logger').default;

const { request } = require('undici');

function makeResponse(obj: any) {
  return { body: { json: async () => obj } };
}

describe('animalHelpers.fetchRandomAnimalImage', () => {
  const baseConfig: IAnimalCommandConfig = {
    apiURL: 'https://api.example/cat',
    animalType: 'cat',
    animalTitle: 'Kot',
    apiSource: 'ExampleAPI',
    errorMessage: 'err',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null on empty array', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([]));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res).toBeNull();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pustą odpowiedź'));
  });

  test('picks non-duplicate if possible', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'A', url: 'u1' }]));
    const first = await fetchRandomAnimalImage(baseConfig);
    expect(first?.id).toBe('A');

    (request as jest.Mock).mockResolvedValueOnce(
      makeResponse([
        { id: 'A', url: 'u1' },
        { id: 'B', url: 'u2' },
      ])
    );
    const second = await fetchRandomAnimalImage(baseConfig);
    expect(second?.id).toBe('B');
  });

  test('second attempt when only duplicate returned', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'X', url: 'x1' }]));
    await fetchRandomAnimalImage(baseConfig);

    (request as jest.Mock)
      .mockResolvedValueOnce(makeResponse([{ id: 'X', url: 'x1' }]))
      .mockResolvedValueOnce(makeResponse([{ id: 'Y', url: 'y1' }]));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res?.id).toBe('Y');
  });

  test('returns duplicate if second attempt also duplicate', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'Z', url: 'z1' }]));
    await fetchRandomAnimalImage(baseConfig);
    (request as jest.Mock)
      .mockResolvedValueOnce(makeResponse([{ id: 'Z', url: 'z1' }]))
      .mockResolvedValueOnce(makeResponse([{ id: 'Z', url: 'z1' }]));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res?.id).toBe('Z');
  });

  test('second request throws during duplicate-avoidance is swallowed (still returns first)', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'Q', url: 'q1' }]));
    await fetchRandomAnimalImage(baseConfig);
    (request as jest.Mock)
      .mockResolvedValueOnce(makeResponse([{ id: 'Q', url: 'q1' }]))
      .mockImplementationOnce(() => Promise.reject(new Error('network fail')));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res?.id).toBe('Q');
  });

  test('aborts on timeout and logs error with timeout marker', async () => {
    jest.useFakeTimers();
    (request as jest.Mock).mockImplementation((_url: string, opts: any) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err: any = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const promise = fetchRandomAnimalImage(baseConfig);
    jest.advanceTimersByTime(4999);
    expect(logger.error).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2);
    const res = await promise;
    expect(res).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('(timeout)')
    );
    jest.useRealTimers();
  });

  test('returns null when chosen image has no url', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'NOURL' }]));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('handles non-array first response object shape', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse({ id: 'OBJ', url: 'u-obj' }));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res?.id).toBe('OBJ');
    expect(res?.url).toBe('u-obj');
  });

  test('duplicate avoidance: second response can be a single object (non-array)', async () => {
    (request as jest.Mock).mockResolvedValueOnce(makeResponse([{ id: 'DUP', url: 'dup' }]));
    await fetchRandomAnimalImage(baseConfig);
    (request as jest.Mock)
      .mockResolvedValueOnce(makeResponse([{ id: 'DUP', url: 'dup' }]))
      .mockResolvedValueOnce(makeResponse({ id: 'ALT', url: 'alt' }));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res?.id).toBe('ALT');
    expect(res?.url).toBe('alt');
  });

  test('logs non-timeout errors without timeout marker and returns null', async () => {
    (request as jest.Mock).mockImplementation(() => Promise.reject(new Error('boom')));
    const res = await fetchRandomAnimalImage(baseConfig);
    expect(res).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.not.stringContaining('(timeout)'));
  });

  test('handleAnimalError sends ephemeral followUp with configured message', async () => {
    const followUp = jest.fn(async () => {});
    const interaction = { followUp } as unknown as CommandInteraction;
    await handleAnimalError(interaction, { ...baseConfig, errorMessage: 'Nie znaleziono' });
    expect(followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Nie znaleziono', flags: expect.any(Number) })
    );
  });

  test('createAnimalEmbed builds embed with expected title, image and footer', () => {
    const baseConfig: IAnimalCommandConfig = {
      apiURL: 'https://api.example/dog',
      animalType: 'dog',
      animalTitle: 'Pies',
      apiSource: 'ExampleAPI',
      errorMessage: 'err',
    };
    const embed = createAnimalEmbed({ id: 'IMG123', url: 'https://example.com/img.jpg' } as any, baseConfig);
    const json = embed.toJSON();
    expect(json.title).toContain('Losowy Pies');
    expect(json.image?.url).toBe('https://example.com/img.jpg');
    expect(json.footer?.text).toContain('ExampleAPI');
    expect(json.footer?.text).toContain('IMG123');
  });
});
