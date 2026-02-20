/**
 * Tests for moderation commands: ban, kick, mute, unban, warn, warnRemove
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({ addFields: jest.fn().mockReturnThis() }),
  createErrorEmbed: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C', WARN: '#F1C40F', WARNINGS_LIST: '#FFD700' },
}));
jest.mock('../../../src/utils/moderationHelpers', () => ({
  canModerate: jest.fn().mockReturnValue(true),
  getModFailMessage: jest.fn().mockReturnValue('Nie możesz moderować tego użytkownika.'),
  formatHumanDuration: jest.fn().mockReturnValue('1d'),
  createModErrorEmbed: jest.fn().mockReturnValue({ addFields: jest.fn().mockReturnThis(), setDescription: jest.fn().mockReturnThis() }),
  createModSuccessEmbed: jest.fn().mockReturnValue({ addFields: jest.fn().mockReturnThis(), setDescription: jest.fn().mockReturnThis() }),
}));
jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/warnService', () => ({
  addWarn: jest.fn().mockResolvedValue({ ok: true, data: { count: 1 } }),
  removeWarn: jest.fn().mockResolvedValue({ ok: true, data: { count: 0 } }),
  getWarns: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));
jest.mock('../../../src/utils/parseDuration', () => ({
  parseDuration: jest.fn().mockReturnValue(86400000),
  parseRawDurationMs: jest.fn().mockReturnValue(86400000),
}));

import { mockInteraction, mockGuildMember, mockUser } from '../../helpers/discordMocks';

describe('Moderation commands - data exports', () => {
  it('ban has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/ban');
    expect(data.name).toBe('ban');
  });

  it('kick has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/kick');
    expect(data.name).toBe('kick');
  });

  it('mute has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/mute');
    expect(data.name).toBe('mute');
  });

  it('unban has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/unban');
    expect(data.name).toBe('unban');
  });

  it('warn has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/warn');
    expect(data.name).toBe('warn');
  });

  it('warnRemove has correct command data', () => {
    const { data } = require('../../../src/commands/moderation/warnRemove');
    expect(data.name).toBe('warn-remove');
  });
});

describe('Moderation commands - options exports', () => {
  it('ban has guildOnly option', () => {
    const { options } = require('../../../src/commands/moderation/ban');
    expect(options.guildOnly).toBe(true);
  });

  it('kick has guildOnly option', () => {
    const { options } = require('../../../src/commands/moderation/kick');
    expect(options.guildOnly).toBe(true);
  });

  it('mute has guildOnly option', () => {
    const { options } = require('../../../src/commands/moderation/mute');
    expect(options.guildOnly).toBe(true);
  });

  it('warn has guildOnly option', () => {
    const { options } = require('../../../src/commands/moderation/warn');
    expect(options.guildOnly).toBe(true);
  });
});

describe('Moderation commands - run functions', () => {
  it('ban.run defers reply', async () => {
    const { run } = require('../../../src/commands/moderation/ban');
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    interaction.guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('kick.run defers reply', async () => {
    const { run } = require('../../../src/commands/moderation/kick');
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    interaction.guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('mute.run defers reply', async () => {
    const { run } = require('../../../src/commands/moderation/mute');
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas') return '1d';
      if (name === 'powod') return 'Spam';
      return null;
    });
    interaction.guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('warn.run defers reply', async () => {
    const { run } = require('../../../src/commands/moderation/warn');
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    interaction.guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });
});
