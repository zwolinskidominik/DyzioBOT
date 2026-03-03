jest.mock('@twurple/auth', () => ({
  AppTokenAuthProvider: jest.fn(),
}));

jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn(),
}));

jest.mock('../../../src/config', () => ({
  env: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { env } from '../../../src/config';
import {
  getTwitchClient,
  validateTwitchUser,
  _resetTwitchClient,
} from '../../../src/utils/twitchApi';

const mockEnv = env as jest.MockedFunction<typeof env>;
const MockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

beforeEach(() => {
  jest.clearAllMocks();
  _resetTwitchClient();
});

/* ── getTwitchClient ─────────────────────────────────────── */

describe('getTwitchClient', () => {
  it('returns null when TWITCH_CLIENT_ID is missing', () => {
    mockEnv.mockReturnValue({ TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: 'secret' } as any);
    expect(getTwitchClient()).toBeNull();
  });

  it('returns null when TWITCH_CLIENT_SECRET is missing', () => {
    mockEnv.mockReturnValue({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: '' } as any);
    expect(getTwitchClient()).toBeNull();
  });

  it('creates and returns an ApiClient when credentials are set', () => {
    mockEnv.mockReturnValue({
      TWITCH_CLIENT_ID: 'myid',
      TWITCH_CLIENT_SECRET: 'mysecret',
    } as any);

    const client = getTwitchClient();
    expect(client).toBeTruthy();
    expect(AppTokenAuthProvider).toHaveBeenCalledWith('myid', 'mysecret');
    expect(ApiClient).toHaveBeenCalledTimes(1);
  });

  it('returns the same singleton on subsequent calls', () => {
    mockEnv.mockReturnValue({
      TWITCH_CLIENT_ID: 'myid',
      TWITCH_CLIENT_SECRET: 'mysecret',
    } as any);

    const first = getTwitchClient();
    const second = getTwitchClient();
    expect(first).toBe(second);
    expect(ApiClient).toHaveBeenCalledTimes(1);
  });

  it('creates a new client after _resetTwitchClient()', () => {
    mockEnv.mockReturnValue({
      TWITCH_CLIENT_ID: 'myid',
      TWITCH_CLIENT_SECRET: 'mysecret',
    } as any);

    const first = getTwitchClient();
    _resetTwitchClient();
    const second = getTwitchClient();
    expect(first).not.toBe(second);
    expect(ApiClient).toHaveBeenCalledTimes(2);
  });
});

/* ── validateTwitchUser ──────────────────────────────────── */

describe('validateTwitchUser', () => {
  const mockGetUserByName = jest.fn();

  beforeEach(() => {
    mockEnv.mockReturnValue({
      TWITCH_CLIENT_ID: 'myid',
      TWITCH_CLIENT_SECRET: 'mysecret',
    } as any);

    MockApiClient.mockImplementation(
      () =>
        ({
          users: { getUserByName: mockGetUserByName },
        }) as any,
    );
  });

  it('returns user info when user exists', async () => {
    mockGetUserByName.mockResolvedValue({
      id: '42',
      name: 'teststreamer',
      displayName: 'TestStreamer',
      profilePictureUrl: 'https://cdn.twitch.tv/pic.jpg',
    });

    const result = await validateTwitchUser('TestStreamer');
    expect(result).toEqual({
      id: '42',
      login: 'teststreamer',
      displayName: 'TestStreamer',
      profilePictureUrl: 'https://cdn.twitch.tv/pic.jpg',
    });
    expect(mockGetUserByName).toHaveBeenCalledWith('teststreamer');
  });

  it('returns null when user does not exist', async () => {
    mockGetUserByName.mockResolvedValue(null);
    const result = await validateTwitchUser('unknown_user');
    expect(result).toBeNull();
  });

  it('returns null (graceful degradation) when credentials are missing', async () => {
    _resetTwitchClient();
    mockEnv.mockReturnValue({ TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' } as any);
    const result = await validateTwitchUser('someone');
    expect(result).toBeNull();
  });

  it('trims and lowercases the login name before calling API', async () => {
    mockGetUserByName.mockResolvedValue(null);
    await validateTwitchUser('  SomeName  ');
    expect(mockGetUserByName).toHaveBeenCalledWith('somename');
  });

  it('propagates API errors', async () => {
    mockGetUserByName.mockRejectedValue(new Error('Twitch API down'));
    await expect(validateTwitchUser('test')).rejects.toThrow('Twitch API down');
  });
});
