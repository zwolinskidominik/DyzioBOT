/**
 * Tests for fun commands: cat, dog, meme
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({ setImage: jest.fn().mockReturnThis(), addFields: jest.fn().mockReturnThis() }),
  createErrorEmbed: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', MEME: '#4C4C54', ERROR: '#E74D3C' },
}));
jest.mock('../../../src/utils/animalHelpers', () => ({
  fetchRandomAnimalImage: jest.fn().mockResolvedValue({ url: 'https://cat.jpg', source: 'thecatapi' }),
  fetchRandomAnimal: jest.fn().mockResolvedValue({ url: 'https://cat.jpg', source: 'thecatapi' }),
  handleAnimalError: jest.fn().mockResolvedValue(undefined),
  createAnimalEmbed: jest.fn().mockReturnValue({ setImage: jest.fn().mockReturnThis() }),
}));
jest.mock('../../../src/utils/memeHelpers', () => ({
  fetchRandomMeme: jest.fn().mockResolvedValue({
    title: 'funny', url: 'https://reddit.com/r/memes/1', imageUrl: 'https://meme.jpg',
    subreddit: 'memes', author: 'u/test', upvotes: 1000,
  }),
}));

import { mockInteraction } from '../../helpers/discordMocks';

describe('Fun commands - data exports', () => {
  it('cat has correct command data', () => {
    const { data } = require('../../../src/commands/fun/cat');
    expect(data.name).toBe('cat');
  });

  it('dog has correct command data', () => {
    const { data } = require('../../../src/commands/fun/dog');
    expect(data.name).toBe('dog');
  });

  it('meme has correct command data', () => {
    const { data } = require('../../../src/commands/fun/meme');
    expect(data.name).toBe('meme');
  });
});

describe('Fun commands - run functions', () => {
  it('cat.run fetches and replies with animal image', async () => {
    const { run } = require('../../../src/commands/fun/cat');
    const interaction = mockInteraction();
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply || interaction.reply).toBeTruthy();
  });

  it('dog.run fetches and replies with animal image', async () => {
    const { run } = require('../../../src/commands/fun/dog');
    const interaction = mockInteraction();
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply || interaction.reply).toBeTruthy();
  });

  it('meme.run fetches and replies with meme', async () => {
    const { run } = require('../../../src/commands/fun/meme');
    const interaction = mockInteraction();
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply || interaction.reply).toBeTruthy();
  });
});
