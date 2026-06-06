import fs from 'fs';
import { buildGreetingMessage, GREETING_DEFAULT_COLORS } from '../../../src/utils/greetingMessageBuilder';
import { GreetingGifStateModel } from '../../../src/models/GreetingGifState';
import { createBaseEmbed } from '../../../src/utils/embedHelpers';
import { IGreetingsConfiguration } from '../../../src/interfaces/Models';

jest.mock('fs');
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/models/GreetingGifState', () => ({
  GreetingGifStateModel: { find: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedCreateBaseEmbed = createBaseEmbed as jest.Mock;
const mockedFind = GreetingGifStateModel.find as jest.Mock;

function makeMember(overrides: Record<string, unknown> = {}): any {
  return {
    user: {
      id: 'user-1',
      username: 'Tester',
      displayAvatarURL: jest.fn(({ size }: { extension?: string; size?: number } = {}) => `https://cdn/avatar-${size ?? 'def'}.png`),
    },
    guild: {
      id: 'guild-1',
      name: 'Test Guild',
      memberCount: 42,
      iconURL: jest.fn(({ size }: { size?: number } = {}) => `https://cdn/icon-${size ?? 'def'}.png`),
    },
    ...overrides,
  };
}

function makeConfig(overrides: Partial<IGreetingsConfiguration> = {}): IGreetingsConfiguration {
  return { guildId: 'guild-1', greetingsChannelId: 'channel-1', ...overrides } as IGreetingsConfiguration;
}

function lastEmbedOpts() {
  return mockedCreateBaseEmbed.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateBaseEmbed.mockImplementation((opts: unknown) => ({ __opts: opts, setImage: jest.fn() }));
  mockedFind.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
  mockedFs.existsSync.mockReturnValue(false);
  mockedFs.readdirSync.mockReturnValue([] as never);
});

describe('buildGreetingMessage — text mode', () => {
  it('returns plain content without embed', async () => {
    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeMessageMode: 'text', welcomeMessage: 'Cześć {user}' }),
      moduleKey: 'welcome',
      defaultMessage: 'default',
      defaultTitle: 'title',
      defaultColor: GREETING_DEFAULT_COLORS.welcome,
      mentionUser: true,
    });

    expect(result.hasEmbed).toBe(false);
    expect(result.payload.content).toBe('Cześć <@user-1>');
    expect(result.payload.embeds).toBeUndefined();
    expect(mockedCreateBaseEmbed).not.toHaveBeenCalled();
  });
});

describe('buildGreetingMessage — variable replacement', () => {
  it('replaces {user} with mention outside DM', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeMessageMode: 'embed', welcomeImageMode: 'none', welcomeMessage: 'Hej {user} na {server} ({memberCount})' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().description).toBe('Hej <@user-1> na Test Guild (42)');
  });

  it('replaces {user} with username inside DM', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ dmMessageMode: 'embed', dmImageMode: 'none', dmMessage: 'Hej {user}' }),
      moduleKey: 'dm',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
      directMessage: true,
    });

    expect(lastEmbedOpts().description).toBe('Hej Tester');
  });
});

describe('buildGreetingMessage — embed color fallback', () => {
  it('uses default color when embedColor is invalid', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeEmbedColor: 'not-a-color' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#123456',
    });

    expect(lastEmbedOpts().color).toBe('#123456');
  });

  it('uses provided color when valid', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeEmbedColor: '#abcdef' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#123456',
    });

    expect(lastEmbedOpts().color).toBe('#abcdef');
  });
});

describe('buildGreetingMessage — thumbnailMode', () => {
  it('defaults to avatar thumbnail when no mode and no file', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBe('https://cdn/avatar-256.png');
  });

  it('uses avatar explicitly even if a thumbnail file exists', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'avatar', welcomeThumbnailFile: 'pic.png' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBe('https://cdn/avatar-256.png');
    expect(result.payload.files).toBeUndefined();
  });

  it('uses custom thumbnail attachment when mode is custom and file exists', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'custom', welcomeThumbnailFile: 'pic.png' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBe('attachment://welcome-thumbnail.png');
    expect(result.payload.files).toHaveLength(1);
  });

  it('falls back to avatar when custom file is missing', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'custom', welcomeThumbnailFile: 'gone.png' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBe('https://cdn/avatar-256.png');
    expect(result.payload.files).toBeUndefined();
  });

  it('omits thumbnail entirely when mode is none', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBeUndefined();
  });

  it('treats legacy config with thumbnail file but no mode as custom', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailFile: 'legacy.png' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    expect(lastEmbedOpts().thumbnail).toBe('attachment://welcome-thumbnail.png');
    expect(result.payload.files).toHaveLength(1);
  });

  it('uses guild icon as DM avatar fallback', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ dmImageMode: 'none', dmThumbnailMode: 'avatar' }),
      moduleKey: 'dm',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
      directMessage: true,
    });

    expect(lastEmbedOpts().thumbnail).toBe('https://cdn/icon-256.png');
  });
});

describe('buildGreetingMessage — image modes', () => {
  it('sets custom image attachment when imageMode is custom', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'custom', welcomeThumbnailMode: 'none', welcomeCustomImageFile: 'img.png' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    const embed = mockedCreateBaseEmbed.mock.results.at(-1)?.value;
    expect(embed.setImage).toHaveBeenCalledWith('attachment://welcome-image.png');
    expect(result.payload.files).toHaveLength(1);
  });

  it('pulls a random gif when imageMode is gifs', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue(['party.gif'] as never);

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'gifs', welcomeThumbnailMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    const embed = mockedCreateBaseEmbed.mock.results.at(-1)?.value;
    expect(embed.setImage).toHaveBeenCalledWith('attachment://welcome-greeting.gif');
    expect(result.payload.files).toHaveLength(1);
  });

  it('does not set an image when imageMode is none', async () => {
    await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    const embed = mockedCreateBaseEmbed.mock.results.at(-1)?.value;
    expect(embed.setImage).not.toHaveBeenCalled();
  });

  it('skips disabled gifs from rotation', async () => {
    mockedFs.existsSync.mockImplementation((target: fs.PathLike) => String(target).includes('lobby') && !String(target).includes('uploads'));
    mockedFs.readdirSync.mockReturnValue(['disabled.gif'] as never);
    mockedFind.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ fileName: 'disabled.gif' }]) }) });

    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'gifs', welcomeThumbnailMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
    });

    const embed = mockedCreateBaseEmbed.mock.results.at(-1)?.value;
    expect(embed.setImage).not.toHaveBeenCalled();
    expect(result.payload.files).toBeUndefined();
  });
});

describe('buildGreetingMessage — mention content', () => {
  it('adds mention content for welcome embed', async () => {
    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ welcomeImageMode: 'none', welcomeThumbnailMode: 'none' }),
      moduleKey: 'welcome',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
      mentionUser: true,
    });

    expect(result.payload.content).toBe('<@user-1>');
    expect(result.hasEmbed).toBe(true);
  });

  it('omits mention content for DM embed', async () => {
    const result = await buildGreetingMessage({
      member: makeMember(),
      config: makeConfig({ dmImageMode: 'none', dmThumbnailMode: 'none' }),
      moduleKey: 'dm',
      defaultMessage: 'd',
      defaultTitle: 't',
      defaultColor: '#ffffff',
      mentionUser: true,
      directMessage: true,
    });

    expect(result.payload.content).toBeUndefined();
  });
});
