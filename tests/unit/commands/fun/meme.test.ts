export {};

// Mocks
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const embedMockFactory = jest.fn((args?: any) => ({
  __embed: true,
  ...args,
  setDescription(desc: string) {
    this.description = desc;
    return this;
  },
  setImage(url: string) {
    this.image = url;
    return this;
  },
  addFields: jest.fn(() => this),
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedMockFactory(args)),
}));

const fetchMeme = jest.fn();
const SITES = { reddit: {}, some: {}, alt: {} } as any;
jest.mock('../../../../src/utils/memeHelpers', () => ({
  __esModule: true,
  fetchMeme: (site: any) => fetchMeme(site),
  SITES: SITES,
}));

const buildInteraction = () => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const interaction: any = { deferReply, editReply };
  return interaction;
};

describe('fun/meme command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('success - image meme formats embed with title/footer', async () => {
    jest.isolateModules(async () => {
      fetchMeme.mockResolvedValue({
        title: 'Funny',
        url: 'https://img/meme.jpg',
        source: 'reddit',
        isVideo: false,
      });
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/meme');
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
      );
      // title and footer propagated to embed factory
      expect(embedMockFactory).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Funny', footerText: expect.stringContaining('Źródło: reddit') })
      );
    });
  });

  test('success - video meme returns files with video.mp4', async () => {
    jest.isolateModules(async () => {
      fetchMeme.mockResolvedValue({
        title: 'Clip',
        url: 'https://cdn/vid.mp4',
        source: 'alt',
        isVideo: true,
      });
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/meme');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ files: [expect.objectContaining({ name: 'video.mp4' })], embeds: [expect.any(Object)] })
      );
    });
  });

  test('missing title/footer → fallback values applied', async () => {
    jest.isolateModules(async () => {
      fetchMeme.mockResolvedValue({
        title: '',
        url: 'https://img/empty.jpg',
        source: 'reddit',
        isVideo: false,
      });
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/meme');
      await run({ interaction, client: {} as any });
      expect(embedMockFactory).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Random meme', footerText: expect.stringContaining('Źródło: reddit') })
      );
    });
  });

  test('primary source error -> alternative success', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      // First call (random site) throws, next call (fallback loop) succeeds
      fetchMeme
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce({ title: 'Alt', url: 'u', source: 'some', isVideo: false });

      // Make Math.random deterministic to pick first site (not required but stable)
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/meme');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      // Alternative succeeded -> editReply with embed
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      (Math.random as any).mockRestore?.();
    });
  });

  test('primary source error -> alternative also fails -> fallback message', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      fetchMeme.mockRejectedValue(new Error('boom'));

      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/fun/meme');
      await run({ interaction, client: {} as any });
      // Logs from primary and try of alternatives
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('nie udało się pobrać mema') })
      );
    });
  });
});
