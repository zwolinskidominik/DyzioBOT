import logger from '../../../../src/utils/logger';

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockDebounce = jest.fn();
jest.mock('../../../../src/utils/cooldownHelpers', () => ({
  debounce: mockDebounce,
}));

const mockUpdateChannelStats = jest.fn();
jest.mock('../../../../src/utils/channelHelpers', () => ({
  updateChannelStats: mockUpdateChannelStats,
}));

jest.useFakeTimers();

let run: any;

describe('guildMemberRemove/updateRemoveMemberStats', () => {
  const mockGuild = { id: 'guild123' };
  const mockMember = {
    guild: mockGuild,
    user: { id: 'user123' },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    if (!run) {
      run = (await import('../../../../src/events/guildMemberRemove/updateRemoveMemberStats')).default;
    }
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('should call debounce with guild id and update function', async () => {
    await run(mockMember);

    expect(mockDebounce).toHaveBeenCalledTimes(1);
    expect(mockDebounce).toHaveBeenCalledWith(
      mockGuild.id,
      expect.any(Function)
    );
  });

  test('should not call debounce if member has no guild', async () => {
    const memberWithoutGuild = {
      guild: null,
      user: { id: 'user123' },
    } as any;

    await run(memberWithoutGuild);

    expect(mockDebounce).not.toHaveBeenCalled();
  });

  test('should not call debounce if member has undefined guild', async () => {
    const memberWithoutGuild = {
      guild: undefined,
      user: { id: 'user123' },
    } as any;

    await run(memberWithoutGuild);

    expect(mockDebounce).not.toHaveBeenCalled();
  });

  test('should return early when member guild is null', async () => {
    const memberWithNullGuild = {
      guild: null,
      user: { id: 'user123' },
    } as any;

    const result = await run(memberWithNullGuild);

    expect(result).toBeUndefined();
    expect(mockDebounce).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should return early when member guild is undefined', async () => {
    const memberWithUndefinedGuild = {
      guild: undefined,
      user: { id: 'user123' },
    } as any;

    const result = await run(memberWithUndefinedGuild);

    expect(result).toBeUndefined();
    expect(mockDebounce).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('debounced function should call updateChannelStats with guild', async () => {
    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledTimes(1);
    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
  });

  test('debounced function should handle updateChannelStats errors and log them', async () => {
    const testError = new Error('Test database connection error');
    mockUpdateChannelStats.mockRejectedValue(testError);

    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
    expect(logger.error).toHaveBeenCalledWith(
      `Błąd w debounced updateChannelStats przy opuszczeniu serwera: ${testError}`
    );
  });

  test('debounced function should handle updateChannelStats success without logging', async () => {
    mockUpdateChannelStats.mockResolvedValue(undefined);

    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('multiple calls with same guild id should use same debounce key', async () => {
    const member1 = { guild: mockGuild, user: { id: 'user1' } } as any;
    const member2 = { guild: mockGuild, user: { id: 'user2' } } as any;

    await run(member1);
    await run(member2);

    expect(mockDebounce).toHaveBeenCalledTimes(2);
    expect(mockDebounce).toHaveBeenNthCalledWith(1, mockGuild.id, expect.any(Function));
    expect(mockDebounce).toHaveBeenNthCalledWith(2, mockGuild.id, expect.any(Function));
  });

  test('calls with different guild ids should use different debounce keys', async () => {
    const guild1 = { id: 'guild1' };
    const guild2 = { id: 'guild2' };
    const member1 = { guild: guild1, user: { id: 'user1' } } as any;
    const member2 = { guild: guild2, user: { id: 'user2' } } as any;

    await run(member1);
    await run(member2);

    expect(mockDebounce).toHaveBeenCalledTimes(2);
    expect(mockDebounce).toHaveBeenNthCalledWith(1, guild1.id, expect.any(Function));
    expect(mockDebounce).toHaveBeenNthCalledWith(2, guild2.id, expect.any(Function));
  });

  test('should handle edge case when debounce throws error', async () => {
    const debounceError = new Error('Debounce error');
    mockDebounce.mockImplementation(() => {
      throw debounceError;
    });

    await expect(run(mockMember)).rejects.toThrow('Debounce error');
  });

  test('debounced function should handle string error messages', async () => {
    const stringError = 'String error message';
    mockUpdateChannelStats.mockRejectedValue(stringError);

    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
    expect(logger.error).toHaveBeenCalledWith(
      `Błąd w debounced updateChannelStats przy opuszczeniu serwera: ${stringError}`
    );
  });

  test('debounced function should handle null/undefined errors', async () => {
    mockUpdateChannelStats.mockRejectedValue(null);

    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
    expect(logger.error).toHaveBeenCalledWith(
      'Błąd w debounced updateChannelStats przy opuszczeniu serwera: null'
    );
  });

  test('should work correctly with minimal member object', async () => {
    const minimalMember = {
      guild: { id: 'minimal-guild' }
    } as any;

    await run(minimalMember);

    expect(mockDebounce).toHaveBeenCalledTimes(1);
    expect(mockDebounce).toHaveBeenCalledWith(
      'minimal-guild',
      expect.any(Function)
    );
  });
});