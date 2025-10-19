export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const fetchRandomAnimalImage = jest.fn();
const createAnimalEmbed = jest.fn();
const handleAnimalError = jest.fn();
jest.mock('../../../../src/utils/animalHelpers', () => ({
  __esModule: true,
  fetchRandomAnimalImage: (...args: any[]) => fetchRandomAnimalImage(...args),
  createAnimalEmbed: (...args: any[]) => createAnimalEmbed(...args),
  handleAnimalError: (...args: any[]) => handleAnimalError(...args),
}));

const buildInteraction = () => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const followUp = jest.fn().mockResolvedValue(undefined);
  const interaction: any = { deferReply, followUp };
  return interaction;
};

describe('fun/animal smoke dog/cat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('dog: no data -> handleAnimalError', async () => {
    jest.isolateModules(async () => {
      fetchRandomAnimalImage.mockResolvedValueOnce(null);
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/dog');
      await run({ interaction, client: {} as any });
      expect(handleAnimalError).toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });
  });

  test('cat: no data -> handleAnimalError', async () => {
    jest.isolateModules(async () => {
      fetchRandomAnimalImage.mockResolvedValueOnce(null);
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/cat');
      await run({ interaction, client: {} as any });
      expect(handleAnimalError).toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });
  });
});
