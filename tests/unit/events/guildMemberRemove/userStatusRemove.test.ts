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

const mockBirthdayModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockTwitchStreamerModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockLevelModel = {
  findOne: jest.fn(),
  deleteOne: jest.fn(),
};

jest.mock('../../../../src/models/Birthday', () => ({
  BirthdayModel: mockBirthdayModel,
}));

jest.mock('../../../../src/models/TwitchStreamer', () => ({
  TwitchStreamerModel: mockTwitchStreamerModel,
}));

jest.mock('../../../../src/models/Level', () => ({
  LevelModel: mockLevelModel,
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
    
    mockBirthdayModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    mockTwitchStreamerModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    mockBirthdayModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    mockTwitchStreamerModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    mockLevelModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    mockLevelModel.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    
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
  });

  test('should search for both birthday and twitch entries', async () => {
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

  test('should deactivate active birthday entry', async () => {
    const activeBirthdayEntry = { active: true };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(activeBirthdayEntry) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: mockGuild.id, userId: mockUser.id },
      { $set: { active: false } }
    );
  });

  test('should deactivate active twitch entry', async () => {
    const activeTwitchEntry = { active: true };
    
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(activeTwitchEntry) 
    });

    await run(mockMember);

    expect(mockTwitchStreamerModel.findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: mockGuild.id, userId: mockUser.id },
      { $set: { active: false } }
    );
  });

  test('should not deactivate already inactive entries', async () => {
    const inactiveEntry = { active: false };
    
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveEntry) 
    });
    mockTwitchStreamerModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(inactiveEntry) 
    });

    await run(mockMember);

    expect(mockBirthdayModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockTwitchStreamerModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('should reset user level when leaving server', async () => {
    const existingLevel = { guildId: mockGuild.id, userId: mockUser.id, level: 5, xp: 1000 };
    
    mockLevelModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(existingLevel) 
    });

    await run(mockMember);

    expect(mockLevelModel.deleteOne).toHaveBeenCalledWith(
      { guildId: mockGuild.id, userId: mockUser.id }
    );
  });

  test('should handle errors gracefully', async () => {
    mockBirthdayModel.findOne.mockReturnValue({ 
      exec: jest.fn().mockRejectedValue(new Error('Database error')) 
    });

    await run(mockMember);

    expect(logger.error).toHaveBeenCalledWith(
      `Błąd podczas dezaktywacji wpisów userId=${mockUser.id}: Error: Database error`
    );
  });
});
