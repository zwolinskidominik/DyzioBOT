export {};

const mockCache = {
  drain: jest.fn(),
};

const mockLevelModel = {
  bulkWrite: jest.fn(),
};

const mockActivityBucketModel = {
  bulkWrite: jest.fn(),
};

jest.mock('../../../../src/cache/xpCache', () => ({
  __esModule: true,
  default: mockCache,
}));

jest.mock('../../../../src/models/Level', () => ({
  LevelModel: mockLevelModel,
}));

jest.mock('../../../../src/models/ActivityBucket', () => ({
  ActivityBucketModel: mockActivityBucketModel,
}));

import flushXp from '../../../../src/events/clientReady/xpFlush';

describe('xpFlush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLevelModel.bulkWrite.mockResolvedValue({});
    mockActivityBucketModel.bulkWrite.mockResolvedValue({});
  });

  it('should do nothing when cache is empty', async () => {
    mockCache.drain.mockReturnValue([]);

    await flushXp();

    expect(mockLevelModel.bulkWrite).not.toHaveBeenCalled();
    expect(mockActivityBucketModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('should flush single user XP data to database', async () => {
    const batch = [
      [
        'guild-123:user-456',
        {
          persistedXp: 50,
          persistedLevel: 5,
          levelDelta: 10,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: {
            msgCount: 5,
            vcMin: 30,
          },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);

    await flushXp();

    expect(mockLevelModel.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { guildId: 'guild-123', userId: 'user-456' },
          update: {
            $set: {
              xp: 60,
              level: 5,
            },
            $max: {
              lastMessageTs: 1000000,
              lastVcUpdateTs: 2000000,
            },
          },
          upsert: true,
        },
      },
    ]);

    expect(mockActivityBucketModel.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { guildId: 'guild-123', userId: 'user-456', bucketStart: '2025-11' },
          update: {
            $inc: {
              msgCount: 5,
              vcMin: 30,
            },
          },
          upsert: true,
        },
      },
    ]);
  });

  it('should flush multiple users XP data', async () => {
    const batch = [
      [
        'guild-123:user-1',
        {
          persistedXp: 100,
          persistedLevel: 10,
          levelDelta: 20,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: { msgCount: 3, vcMin: 15 },
        },
      ],
      [
        'guild-123:user-2',
        {
          persistedXp: 200,
          persistedLevel: 15,
          levelDelta: 30,
          lastMessageTs: 1100000,
          lastVcUpdateTs: 2100000,
          bucketStart: '2025-11',
          bucket: { msgCount: 7, vcMin: 45 },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);

    await flushXp();

    expect(mockLevelModel.bulkWrite).toHaveBeenCalled();
    const levelOps = mockLevelModel.bulkWrite.mock.calls[0][0];
    expect(levelOps).toHaveLength(2);
    expect(levelOps[0].updateOne.filter.userId).toBe('user-1');
    expect(levelOps[1].updateOne.filter.userId).toBe('user-2');

    expect(mockActivityBucketModel.bulkWrite).toHaveBeenCalled();
    const bucketOps = mockActivityBucketModel.bulkWrite.mock.calls[0][0];
    expect(bucketOps).toHaveLength(2);
  });

  it('should handle database errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const batch = [
      [
        'guild-123:user-456',
        {
          persistedXp: 50,
          persistedLevel: 5,
          levelDelta: 10,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: { msgCount: 5, vcMin: 30 },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);
    mockLevelModel.bulkWrite.mockRejectedValue(new Error('Database error'));

    await flushXp();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[XP-FLUSH] Error during flush:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should correctly parse guild and user IDs from cache keys', async () => {
    const batch = [
      [
        'guild-abc:user-xyz',
        {
          persistedXp: 50,
          persistedLevel: 5,
          levelDelta: 10,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: { msgCount: 5, vcMin: 30 },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);

    await flushXp();

    const levelOps = mockLevelModel.bulkWrite.mock.calls[0][0];
    expect(levelOps[0].updateOne.filter).toEqual({
      guildId: 'guild-abc',
      userId: 'user-xyz',
    });
  });

  it('should use $max for timestamp updates', async () => {
    const batch = [
      [
        'guild-123:user-456',
        {
          persistedXp: 50,
          persistedLevel: 5,
          levelDelta: 10,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: { msgCount: 5, vcMin: 30 },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);

    await flushXp();

    const levelOps = mockLevelModel.bulkWrite.mock.calls[0][0];
    expect(levelOps[0].updateOne.update.$max).toEqual({
      lastMessageTs: 1000000,
      lastVcUpdateTs: 2000000,
    });
  });

  it('should use $inc for activity bucket counters', async () => {
    const batch = [
      [
        'guild-123:user-456',
        {
          persistedXp: 50,
          persistedLevel: 5,
          levelDelta: 10,
          lastMessageTs: 1000000,
          lastVcUpdateTs: 2000000,
          bucketStart: '2025-11',
          bucket: { msgCount: 12, vcMin: 67 },
        },
      ],
    ];

    mockCache.drain.mockReturnValue(batch);

    await flushXp();

    const bucketOps = mockActivityBucketModel.bulkWrite.mock.calls[0][0];
    expect(bucketOps[0].updateOne.update.$inc).toEqual({
      msgCount: 12,
      vcMin: 67,
    });
  });
});
