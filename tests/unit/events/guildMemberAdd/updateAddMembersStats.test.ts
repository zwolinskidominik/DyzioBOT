import logger from '../../../../src/utils/logger';

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock debounce
const mockDebounce = jest.fn();
jest.mock('../../../../src/utils/cooldownHelpers', () => ({
  debounce: mockDebounce,
}));

// Mock updateChannelStats
const mockUpdateChannelStats = jest.fn();
jest.mock('../../../../src/utils/channelHelpers', () => ({
  updateChannelStats: mockUpdateChannelStats,
}));

// Use fake timers for debounce testing
jest.useFakeTimers();

let run: any;

describe('guildMemberAdd/updateAddMembersStats', () => {
  const mockGuild = { id: 'guild123' };
  const mockMember = {
    guild: mockGuild,
    user: { id: 'user123' },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    if (!run) {
      run = (await import('../../../../src/events/guildMemberAdd/updateAddMembersStats')).default;
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

  test('debounced function should call updateChannelStats with guild', async () => {
    // Mock debounce to immediately execute the function
    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledTimes(1);
    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
  });

  test('debounced function should handle updateChannelStats errors', async () => {
    const testError = new Error('Test error');
    mockUpdateChannelStats.mockRejectedValue(testError);

    // Mock debounce to immediately execute the function
    mockDebounce.mockImplementation((key: string, fn: Function) => {
      return fn();
    });

    await run(mockMember);

    expect(mockUpdateChannelStats).toHaveBeenCalledWith(mockGuild);
    expect(logger.error).toHaveBeenCalledWith(
      `Błąd w debounced updateChannelStats: ${testError}`
    );
  });

  test('debounced function should handle updateChannelStats success', async () => {
    mockUpdateChannelStats.mockResolvedValue(undefined);

    // Mock debounce to immediately execute the function
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
});