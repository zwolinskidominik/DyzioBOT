export {};

const logger = { error: jest.fn().mockReturnThis(), warn: jest.fn().mockReturnThis() };
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: logger }));

describe('commands/admin/ticket-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildInteraction = (withGuild = true) => {
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const guild = withGuild ? ({ id: 'g1', name: 'Guild' } as any) : undefined;
    return { deferReply, editReply, guild } as any;
  };

  test('DM usage -> early error message', async () => {
    const interaction = buildInteraction(false);
    await jest.isolateModulesAsync(async () => {
      const { run } = await import('../../../../src/commands/admin/ticketStats');
      await run({ interaction, client: {} as any });
    });
    expect(interaction.editReply).toHaveBeenCalledWith('Ta komenda działa tylko na serwerze.');
  });

  test('no stats -> informs user', async () => {
    const interaction = buildInteraction(true);
    await jest.isolateModulesAsync(async () => {
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
      };
      jest.doMock('../../../../src/models/TicketStats', () => ({
        __esModule: true,
        TicketStatsModel: { find: jest.fn(() => findChain) },
      }));
      const { run } = await import('../../../../src/commands/admin/ticketStats');
      await run({ interaction, client: {} as any });
    });
    expect(interaction.editReply).toHaveBeenCalledWith({ content: 'Brak statystyk zgłoszeń na tym serwerze.' });
  });

  test('model throws -> logs and replies with generic error', async () => {
    const interaction = buildInteraction(true);
    await jest.isolateModulesAsync(async () => {
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValueOnce(new Error('db down')),
      };
      jest.doMock('../../../../src/models/TicketStats', () => ({
        __esModule: true,
        TicketStatsModel: { find: jest.fn(() => findChain) },
      }));
      const { run } = await import('../../../../src/commands/admin/ticketStats');
      await run({ interaction, client: {} as any });
    });
    expect(logger.error).toHaveBeenCalled();
    const callArg = (interaction.editReply as jest.Mock).mock.calls[0]?.[0];
    if (typeof callArg === 'string') {
      expect(callArg).toContain('Wystąpił błąd');
    } else {
      expect(callArg).toEqual('Wystąpił błąd podczas pobierania statystyk.');
    }
  });
});
