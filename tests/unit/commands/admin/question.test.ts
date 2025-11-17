export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({
    __embed: true,
    setDescription(desc: string) {
      this.description = desc;
      return this;
    },
    ...args,
  })),
}));

jest.mock('../../../../src/config/bot', () => ({
  __esModule: true,
  getBotConfig: jest.fn(() => ({ emojis: { next: '➡️', previous: '⬅️' } })),
}));
const qCtor = jest.fn((payload: any) => ({ ...payload, save: jest.fn().mockResolvedValue(undefined) }));
(qCtor as any).find = jest.fn();
(qCtor as any).findByIdAndDelete = jest.fn();
(qCtor as any).countDocuments = jest.fn();

jest.mock('../../../../src/models/Question', () => ({
  __esModule: true,
  QuestionModel: qCtor,
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getSubcommand: jest.fn(() => 'add'),
    getString: jest.fn(),
    getInteger: jest.fn(),
  };
  const channel = {
    messages: { fetch: jest.fn() },
  };
  const interaction = {
    reply,
    deferReply,
    editReply,
    options,
    channel,
    user: { id: 'req' },
    client: { application: { id: 'bot' } },
  } as any;
  return Object.assign(interaction, over);
};

describe('admin/question command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  qCtor.mockClear();
    (qCtor as any).find.mockReset();
    (qCtor as any).findByIdAndDelete.mockReset();
    (qCtor as any).countDocuments.mockReset();
  });

  describe('add', () => {
    test('rejects when content length < 5', async () => {
      jest.isolateModules(async () => {
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'tresc') return 'abcd';
          if (name === 'reakcje') return '👍 👎';
          return null;
        });
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
        );
      });
    });

    test('invalid reactions count (too few / too many)', async () => {
      jest.isolateModules(async () => {
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'tresc') return 'Valid question content';
          if (name === 'reakcje') return '👍';
          return null;
        });
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
        );

        interaction.editReply.mockClear();
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'tresc') return 'Valid question content';
          if (name === 'reakcje') return '😀 😃 😄 😁 😆 😅';
          return null;
        });
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('invalid emoji provided', async () => {
      jest.isolateModules(async () => {
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'tresc') return 'Another valid question';
          if (name === 'reakcje') return 'ok !!';
          return null;
        });
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
        );
      });
    });

    test('happy path saves and replies success', async () => {
      jest.isolateModules(async () => {
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'tresc') return 'This is a valid question?';
          if (name === 'reakcje') return '👍 👎';
          return null;
        });
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
  expect(qCtor.mock.calls[0][0]).toEqual(
          expect.objectContaining({ authorId: 'req', content: expect.any(String), reactions: ['👍', '👎'] })
        );
  const instance = qCtor.mock.results[0].value;
        expect(instance.save).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });

  describe('list', () => {
    test('empty list shows no questions message', async () => {
      jest.isolateModules(async () => {
  (qCtor as any).find.mockReturnValue({ sort: () => ({ lean: () => [] }) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const collector = { on: jest.fn() };
        const replyHost = { id: 'm1', createMessageComponentCollector: jest.fn(() => collector) };
        interaction.editReply = jest.fn().mockResolvedValue(replyHost);
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)], components: [expect.any(Object)] })
        );
      });
    });

    test('pagination next and prev updates embed', async () => {
      jest.isolateModules(async () => {
        const mockQuestions = Array.from({ length: 12 }).map((_, i) => ({
          content: `Q${i + 1}`,
          reactions: ['👍', '👎'],
        }));
  (qCtor as any).find.mockReturnValue({ sort: () => ({ lean: () => mockQuestions }) });

        const interaction = buildInteraction({ channel: { messages: { fetch: jest.fn().mockResolvedValue({ edit: jest.fn() }) } } });
        interaction.options.getSubcommand.mockReturnValue('list');

        const handlers: Record<string, Function[]> = { collect: [], end: [] } as any;
        const collector = { on: jest.fn((evt: string, cb: any) => { handlers[evt].push(cb); }) };
        const replyHost: any = { id: 'msg1', components: [{}, {}], createMessageComponentCollector: jest.fn(() => collector), edit: jest.fn() };
        interaction.editReply = jest.fn().mockResolvedValue(replyHost);

        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });

        const mkBtn = (id: string) => ({
          customId: id,
          user: { id: interaction.user.id },
          deferUpdate: jest.fn().mockResolvedValue(undefined),
          editReply: jest.fn().mockResolvedValue(undefined),
        });
        await handlers.collect[0](mkBtn('next'));
        await handlers.collect[0](mkBtn('next'));
        await handlers.collect[0](mkBtn('prev'));

        expect((mkBtn('x') as any).editReply).not.toBeCalled();
        expect(replyHost.edit).not.toHaveBeenCalled();
      });
    });
  });

  describe('remove', () => {
    test('invalid range (0 or > count) -> ephemeral reply', async () => {
      jest.isolateModules(async () => {
  (qCtor as any).countDocuments.mockResolvedValue(3);
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getInteger.mockImplementation((name: string) => (name === 'numer' ? 0 : null));
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(
          expect.objectContaining({ flags: expect.any(Number), embeds: [expect.any(Object)] })
        );

        interaction.reply.mockClear();
        interaction.options.getInteger.mockImplementation((name: string) => (name === 'numer' ? 4 : null));
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalled();
      });
    });

    test('within range but not found in fetched list', async () => {
      jest.isolateModules(async () => {
  (qCtor as any).countDocuments.mockResolvedValue(5);
  (qCtor as any).find.mockReturnValue({ sort: () => [] });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getInteger.mockImplementation((name: string) => (name === 'numer' ? 5 : null));
        const { run } = await import('../../../../src/commands/admin/question');
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });
});
