jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const updateOne = jest.fn();
const findOne = jest.fn();
jest.mock('../../../src/models/MinecraftStatsSnapshot', () => ({
  MinecraftStatsSnapshotModel: {
    updateOne: (...args: unknown[]) => updateOne(...args),
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));
jest.mock('../../../src/models/MinecraftLink', () => ({ MinecraftLinkModel: {} }));

import {
  MinecraftStatsService,
  STATS_CACHE_MS,
  findPlayer,
  formatPlayTime,
  rankPlayers,
  type PlayerStats,
} from '../../../src/services/minecraft/statsService';

const CONFIG = { guildId: '881293681783623680', controlUrl: 'https://control.example', controlToken: 'x'.repeat(32) };
const BODY = {
  updatedAt: '2026-11-27T12:00:00Z',
  players: [
    { uuid: 'a', name: 'Kuba', playTime: 72_000 * 3, deaths: 4 },
    { uuid: 'b', name: 'Ola_2', playTime: 72_000 * 5, deaths: 1 },
  ],
};
const response = (status: number, body: unknown) => Promise.resolve({ status, json: () => Promise.resolve(body) });

describe('MinecraftStatsService', () => {
  beforeEach(() => {
    updateOne.mockReset().mockReturnValue(Promise.resolve());
    findOne.mockReset().mockReturnValue({ lean: () => Promise.resolve(null) });
  });

  it('downloads /stats with the bearer token, saves a snapshot and caches it for 5 minutes', async () => {
    let now = 1_000;
    const fetchImpl = jest.fn().mockImplementation(() => response(200, BODY));
    const service = new MinecraftStatsService(CONFIG, { fetchImpl, now: () => now });

    const first = await service.get();
    expect(first.ok && first.data.players).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example/stats',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${CONFIG.controlToken}` }) })
    );
    expect(updateOne).toHaveBeenCalledWith({ guildId: CONFIG.guildId }, expect.anything(), { upsert: true });

    await service.get();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += STATS_CACHE_MS;
    await service.get();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back to the last saved snapshot when the service is down', async () => {
    findOne.mockReturnValue({
      lean: () => Promise.resolve({ statsUpdatedAt: new Date('2026-11-26T10:00:00Z'), players: BODY.players }),
    });
    const service = new MinecraftStatsService(CONFIG, { fetchImpl: () => Promise.reject(new Error('timeout')) });
    const result = await service.get();
    expect(result).toMatchObject({ ok: true, data: { stale: true } });
  });

  it('reports a missing endpoint as not ready and a bad body as unavailable', async () => {
    await expect(new MinecraftStatsService(CONFIG, { fetchImpl: () => response(404, {}) }).get()).resolves.toEqual({
      ok: false,
      reason: 'not_ready',
    });
    const bad = { ...BODY, players: [{ uuid: 'x', name: 'bad nick!', playTime: 1, deaths: 0 }] };
    await expect(new MinecraftStatsService(CONFIG, { fetchImpl: () => response(200, bad) }).get()).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

describe('stats helpers', () => {
  const players: PlayerStats[] = [
    { uuid: '1', name: 'Zed', playTime: 100, deaths: 5 },
    { uuid: '2', name: 'Ann', playTime: 300, deaths: 5 },
    { uuid: '3', name: 'Bob', playTime: 200, deaths: 9 },
  ];

  it('ranks by the chosen metric, ties alphabetically', () => {
    expect(rankPlayers(players, 'playtime').map((p) => p.name)).toEqual(['Ann', 'Bob', 'Zed']);
    expect(rankPlayers(players, 'deaths').map((p) => p.name)).toEqual(['Bob', 'Ann', 'Zed']);
  });

  it('finds a player case-insensitively', () => {
    expect(findPlayer(players, 'bOb')?.uuid).toBe('3');
    expect(findPlayer(players, 'nobody')).toBeNull();
  });

  it('formats ticks as hours and minutes', () => {
    expect(formatPlayTime(20 * 60 * 35)).toBe('35 min');
    expect(formatPlayTime(20 * 60 * (12 * 60 + 5))).toBe('12 h 5 min');
  });
});
