export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const embedFactory = jest.fn((args?: any) => ({ ...args }));
jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

// mock animal helpers
const helpers: any = {
  fetchRandomAnimalImage: jest.fn(),
  createAnimalEmbed: jest.fn((data: any, cfg: any) => ({ image: data.url, title: `Losowy ${cfg.animalTitle}` })),
  handleAnimalError: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../../src/utils/animalHelpers', () => ({
  __esModule: true,
  fetchRandomAnimalImage: (...a: any[]) => helpers.fetchRandomAnimalImage(...a),
  createAnimalEmbed: (...a: any[]) => helpers.createAnimalEmbed(...a),
  handleAnimalError: (...a: any[]) => helpers.handleAnimalError(...a),
}));

const buildInteraction = () => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const followUp = jest.fn().mockResolvedValue(undefined);
  return { deferReply, followUp } as any;
};

describe('fun/cat & fun/dog', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cat: happy path - sends embed with image URL', async () => {
    await jest.isolateModules(async () => {
      helpers.fetchRandomAnimalImage.mockResolvedValue({ id: 'c1', url: 'https://img/cat.jpg' });
      const { run } = await import('../../../../src/commands/fun/cat');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(helpers.createAnimalEmbed).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ image: 'https://img/cat.jpg' })] })
      );
    });
  });

  test('dog: happy path - sends embed with image URL', async () => {
    await jest.isolateModules(async () => {
      helpers.fetchRandomAnimalImage.mockResolvedValue({ id: 'd1', url: 'https://img/dog.jpg' });
      const { run } = await import('../../../../src/commands/fun/dog');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(helpers.createAnimalEmbed).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ image: 'https://img/dog.jpg' })] })
      );
    });
  });
});
