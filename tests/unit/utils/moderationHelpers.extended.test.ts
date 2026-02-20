/* pretty-ms is ESM-only — mock it so Jest can import moderationHelpers */
jest.mock('pretty-ms', () => ({
  __esModule: true,
  default: (ms: number) => `${ms}ms`,
}));

import {
  createModErrorEmbed,
  createModSuccessEmbed,
  findBannedUser,
} from '../../../src/utils/moderationHelpers';
import { mockUser, mockGuild } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── createModErrorEmbed ──────────────────────────────────── */

describe('createModErrorEmbed', () => {
  it('creates embed with bold description', () => {
    const embed = createModErrorEmbed('Some error', 'GuildName');
    expect(embed.data.description).toBe('**Some error**');
    expect(embed.data.footer?.text).toBe('GuildName');
  });

  it('handles empty description', () => {
    const embed = createModErrorEmbed('');
    // EmbedBuilder normalizes empty string to undefined
    expect(embed.data.description ?? '').toBe('');
  });

  it('uses error color', () => {
    const embed = createModErrorEmbed('err');
    expect(embed.data.color).toBeTruthy();
  });
});

/* ── createModSuccessEmbed ────────────────────────────────── */

describe('createModSuccessEmbed', () => {
  const target = mockUser({ id: 'target-1', username: 'Target' });
  const mod = mockUser({ id: 'mod-1', username: 'Mod' });

  it('creates ban embed with target mention', () => {
    const embed = createModSuccessEmbed('ban', target, mod, null, 'Guild');
    expect(embed.data.description).toContain('Zbanowano');
    expect(embed.data.description).toContain('target-1');
  });

  it('creates kick embed', () => {
    const embed = createModSuccessEmbed('kick', target, mod, null, 'Guild');
    expect(embed.data.description).toContain('Wyrzucono');
  });

  it('creates mute embed with duration', () => {
    const embed = createModSuccessEmbed('mute', target, mod, null, 'Guild', 'Spam', '1h');
    expect(embed.data.description).toContain('wyciszony');
    expect(embed.data.description).toContain('1h');
  });

  it('creates unban embed', () => {
    const embed = createModSuccessEmbed('unban', target, mod, null, 'Guild');
    expect(embed.data.description).toContain('Odbanowano');
  });

  it('creates warn embed', () => {
    const embed = createModSuccessEmbed('warn', target, mod, null, 'Guild', 'Spam');
    expect(embed.data.description).toContain('Ostrzeżono');
  });

  it('adds moderator field', () => {
    const embed = createModSuccessEmbed('ban', target, mod, null, 'Guild', 'Reason');
    const fields = embed.data.fields ?? [];
    expect(fields.some((f: any) => f.name === 'Moderator')).toBe(true);
  });

  it('adds reason field for non-unban', () => {
    const embed = createModSuccessEmbed('ban', target, mod, null, 'Guild', 'Bad behavior');
    const fields = embed.data.fields ?? [];
    expect(fields.some((f: any) => f.name === 'Powód' && f.value === 'Bad behavior')).toBe(true);
  });

  it('omits reason field for unban', () => {
    const embed = createModSuccessEmbed('unban', target, mod, null, 'Guild', 'Reason');
    const fields = embed.data.fields ?? [];
    expect(fields.some((f: any) => f.name === 'Powód')).toBe(false);
  });
});

/* ── findBannedUser ───────────────────────────────────────── */

describe('findBannedUser', () => {
  it('returns user from bans cache if present', async () => {
    const user = mockUser({ id: 'banned-1' });
    const bansCache = new Collection<string, any>();
    bansCache.set('banned-1', { user });
    const guild = mockGuild() as any;
    guild.bans.cache = bansCache;

    const result = await findBannedUser(guild, 'banned-1');
    expect(result).toBe(user);
  });

  it('returns user from fetched ban', async () => {
    const user = mockUser({ id: 'banned-2' });
    const guild = mockGuild() as any;
    guild.bans.cache = new Collection();
    guild.bans.fetch = jest.fn().mockResolvedValue({ user });

    const result = await findBannedUser(guild, 'banned-2');
    expect(result).toBe(user);
  });

  it('returns null when user is not banned', async () => {
    const guild = mockGuild() as any;
    guild.bans.cache = new Collection();
    guild.bans.fetch = jest.fn().mockResolvedValue(null);

    const result = await findBannedUser(guild, 'not-banned');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    const guild = mockGuild() as any;
    guild.bans.cache = new Collection();
    guild.bans.fetch = jest.fn().mockRejectedValue(new Error('Forbidden'));

    const result = await findBannedUser(guild, 'err');
    expect(result).toBeNull();
  });
});
