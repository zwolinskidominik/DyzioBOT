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

// Mock models
const mockBirthdayModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockTwitchStreamerModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

jest.mock('../../../../src/models/Birthday', () => ({
  BirthdayModel: mockBirthdayModel,
}));

jest.mock('../../../../src/models/TwitchStreamer', () => ({
  TwitchStreamerModel: mockTwitchStreamerModel,
}));

let run: any;

describe('guildMemberRemove/userStatusRemove', () => {
  const mockGuild = { id: 'guild123' };
  const mockUser = { id: 'user123' };
  const mockMember = {
    guild: mockGuild,
    user: mockUser,
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockBirthdayModel.findOne.mockReturnValue({ exec: jest.fn() });
    mockTwitchStreamerModel.findOne.mockReturnValue({ exec: jest.fn() });
    mockBirthdayModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn() });
    mockTwitchStreamerModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn() });
    
    if (!run) {
      run = (await import('../../../../src/events/guildMemberRemove/userStatusRemove')).default;
    }
  });

  test('should not process if member has no guild', async () => {
    const memberWithoutGuild = {
      guild: null,
      user: mockUser,
    } as any;

    await run(memberWithoutGuild);

    expect(mockBirthdayModel.findOne).not.toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOne).not.toHaveBeenCalled();
  });

  test('should not process if member has undefined guild', async () => {
    const memberWithoutGuild = {
      guild: undefined,
      user: mockUser,
    } as any;

    await run(memberWithoutGuild);

    expect(mockBirthdayModel.findOne).not.toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOne).not.toHaveBeenCalled();
  });

  test('should search for both birthday and twitch entries', async () => {
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(null) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(null) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOne).toHaveBeenCalledWith({
      guildId: mockGuild.id,
      userId: mockUser.id,
    });
    expect(mockTwitchStreamerModel.findOne).toHaveBeenCalledWith({
      guildId: mockGuild.id,
      userId: mockUser.id,
    });
  });

  test('should reactivate inactive birthday entry', async () => {
    const inactiveBirthdayEntry = { active: false };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveBirthdayEntry) 
    });
    mockBirthdayModel.findOneAndUpdate.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue({}) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(null) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: mockGuild.id, userId: mockUser.id },
      { $set: { active: true } }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Reaktywowano wpis birthday dla userId=${mockUser.id}`
    );
  });

  test('should reactivate inactive twitch entry', async () => {
    const inactiveTwitchEntry = { active: false };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(null) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveTwitchEntry) 
    });
    mockTwitchStreamerModel.findOneAndUpdate.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue({}) 
    });

    await run(mockMember);

    expect(mockTwitchStreamerModel.findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: mockGuild.id, userId: mockUser.id },
      { $set: { active: true } }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Reaktywowano wpis twitch dla userId=${mockUser.id}`
    );
  });

  test('should reactivate both inactive entries', async () => {
    const inactiveBirthdayEntry = { active: false };
    const inactiveTwitchEntry = { active: false };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveBirthdayEntry) 
    });
    mockBirthdayModel.findOneAndUpdate.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue({}) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveTwitchEntry) 
    });
    mockTwitchStreamerModel.findOneAndUpdate.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue({}) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOneAndUpdate).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  test('should not reactivate active entries', async () => {
    const activeBirthdayEntry = { active: true };
    const activeTwitchEntry = { active: true };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(activeBirthdayEntry) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(activeTwitchEntry) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  test('should not reactivate entries with undefined active field', async () => {
    const entryWithoutActive = { someOtherField: 'value' };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(entryWithoutActive) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(entryWithoutActive) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  test('should handle errors gracefully', async () => {
    const testError = new Error('Database error');
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockRejectedValue(testError) 
    });

    await run(mockMember);

    expect(logger.error).toHaveBeenCalledWith(
      `Błąd podczas reaktywacji wpisów userId=${mockUser.id}: ${testError}`
    );
  });

  test('should handle model query errors', async () => {
    const testError = new Error('Query error');
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue({ active: false }) 
    });
    mockBirthdayModel.findOneAndUpdate.mockReturnValue({ 
      exec: jest.fn().mockRejectedValue(testError) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(null) 
    });

    await run(mockMember);

    expect(logger.error).toHaveBeenCalledWith(
      `Błąd podczas reaktywacji wpisów userId=${mockUser.id}: ${testError}`
    );
  });
});