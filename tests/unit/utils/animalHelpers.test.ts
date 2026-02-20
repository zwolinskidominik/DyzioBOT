jest.mock('undici', () => ({
  request: jest.fn(),
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({ setTitle: jest.fn().mockReturnThis() }),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  fetchRandomAnimalImage,
  createAnimalEmbed,
  handleAnimalError,
} from '../../../src/utils/animalHelpers';
import { request } from 'undici';
import { createBaseEmbed } from '../../../src/utils/embedHelpers';

const mockRequest = request as jest.MockedFunction<typeof request>;

const config = {
  apiURL: 'https://api.example.com/animals',
  apiSource: 'TestAPI',
  animalType: 'cat',
  animalTitle: 'Kot',
  errorMessage: 'Nie udało się pobrać kota.',
};

function apiResponse(data: any): any {
  return {
    body: { json: jest.fn().mockResolvedValue(data) },
  };
}

/* ── fetchRandomAnimalImage ──────────────────────────── */
describe('fetchRandomAnimalImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns image from array response', async () => {
    mockRequest.mockResolvedValue(
      apiResponse([{ id: 'a1', url: 'https://cat.jpg' }]) as any,
    );
    const result = await fetchRandomAnimalImage(config);
    expect(result).toEqual({ id: 'a1', url: 'https://cat.jpg' });
  });

  it('returns image from single-object response', async () => {
    mockRequest.mockResolvedValue(
      apiResponse({ id: 'a1', url: 'https://cat.jpg' }) as any,
    );
    const result = await fetchRandomAnimalImage(config);
    expect(result).toEqual({ id: 'a1', url: 'https://cat.jpg' });
  });

  it('returns null when array is empty', async () => {
    mockRequest.mockResolvedValue(apiResponse([]) as any);
    const result = await fetchRandomAnimalImage(config);
    expect(result).toBeNull();
  });

  it('returns null when url is missing', async () => {
    mockRequest.mockResolvedValue(
      apiResponse([{ id: 'a1' }]) as any, // no url
    );
    const result = await fetchRandomAnimalImage(config);
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await fetchRandomAnimalImage(config);
    expect(result).toBeNull();
  });

  it('avoids duplicate by trying second request when same ID', async () => {
    // First call sets lastImageId
    mockRequest.mockResolvedValueOnce(
      apiResponse([{ id: 'dup', url: 'https://dup.jpg' }]) as any,
    );
    await fetchRandomAnimalImage(config);

    // Second call: first response same ID, second response different
    mockRequest.mockResolvedValueOnce(
      apiResponse([{ id: 'dup', url: 'https://dup.jpg' }]) as any,
    );
    mockRequest.mockResolvedValueOnce(
      apiResponse([{ id: 'new', url: 'https://new.jpg' }]) as any,
    );
    const result = await fetchRandomAnimalImage(config);
    expect(result?.id).toBe('new');
  });

  it('picks alt from first response if multiple results', async () => {
    // First call
    mockRequest.mockResolvedValueOnce(
      apiResponse([{ id: 'first', url: 'https://first.jpg' }]) as any,
    );
    await fetchRandomAnimalImage(config);

    // Second call returns array with both old and new
    mockRequest.mockResolvedValueOnce(
      apiResponse([
        { id: 'first', url: 'https://first.jpg' },
        { id: 'second', url: 'https://second.jpg' },
      ]) as any,
    );
    const result = await fetchRandomAnimalImage(config);
    expect(result?.id).toBe('second');
  });
});

/* ── createAnimalEmbed ───────────────────────────────── */
describe('createAnimalEmbed', () => {
  it('calls createBaseEmbed with correct params', () => {
    const animal = { id: 'a1', url: 'https://cat.jpg' };
    createAnimalEmbed(animal, config);
    expect(createBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Losowy Kot',
        image: 'https://cat.jpg',
        footerText: expect.stringContaining('a1'),
      }),
    );
  });
});

/* ── handleAnimalError ───────────────────────────────── */
describe('handleAnimalError', () => {
  it('sends error message as ephemeral followUp', async () => {
    const interaction: any = {
      followUp: jest.fn().mockResolvedValue(undefined),
    };
    await handleAnimalError(interaction, config);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: config.errorMessage,
      }),
    );
  });
});
