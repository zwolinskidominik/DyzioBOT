import { createLogEmbed, truncate } from '../../../src/utils/logHelpers';

/* ── truncate ─────────────────────────────────────────────── */

describe('truncate', () => {
  it('returns original text when within limit', () => {
    expect(truncate('hello', 1024)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    const long = 'a'.repeat(2000);
    const result = truncate(long, 100);
    expect(result).toHaveLength(100);
    expect(result.endsWith('...')).toBe(true);
  });

  it('uses default maxLength of 1024', () => {
    const long = 'x'.repeat(2000);
    const result = truncate(long);
    expect(result).toHaveLength(1024);
    expect(result.endsWith('...')).toBe(true);
  });

  it('returns string as-is when exactly maxLength', () => {
    const exact = 'z'.repeat(1024);
    expect(truncate(exact)).toBe(exact);
  });

  it('handles empty string', () => {
    expect(truncate('')).toBe('');
  });
});

/* ── createLogEmbed ───────────────────────────────────────── */

describe('createLogEmbed', () => {
  it('creates embed with event config defaults', () => {
    const embed = createLogEmbed('memberJoin', { description: 'User joined' });
    expect(embed.data.description).toBe('User joined');
    expect(embed.data.color).toBeTruthy();
  });

  it('uses provided title instead of default', () => {
    const embed = createLogEmbed('memberJoin', { title: 'Custom Title' });
    expect(embed.data.title).toBe('Custom Title');
  });

  it('omits title when title is null', () => {
    const embed = createLogEmbed('memberJoin', { title: null });
    expect(embed.data.title).toBeUndefined();
  });

  it('sets fields when provided', () => {
    const fields = [{ name: 'Field', value: 'Val', inline: true }];
    const embed = createLogEmbed('channelCreate', { fields });
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.fields![0].name).toBe('Field');
  });

  it('sets author when provided', () => {
    const embed = createLogEmbed('memberLeave', {
      authorName: 'TestBot',
      authorIcon: 'https://example.com/icon.png',
    });
    expect(embed.data.author?.name).toBe('TestBot');
  });

  it('sets image and thumbnail', () => {
    const embed = createLogEmbed('messageDelete', {
      image: 'https://img.com/1.png',
      thumbnail: 'https://img.com/t.png',
    });
    expect(embed.data.image?.url).toBe('https://img.com/1.png');
    expect(embed.data.thumbnail?.url).toBe('https://img.com/t.png');
  });

  it('sets footer when provided', () => {
    const embed = createLogEmbed('roleCreate', {
      footer: 'Footer text',
      footerIcon: 'https://img.com/f.png',
    });
    expect(embed.data.footer?.text).toBe('Footer text');
    expect(embed.data.footer?.icon_url).toBe('https://img.com/f.png');
  });

  it('sets explicit Date timestamp', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const embed = createLogEmbed('memberJoin', { timestamp: date });
    expect(embed.data.timestamp).toBe(date.toISOString());
  });

  it('auto-sets timestamp when timestamp is not false', () => {
    const embed = createLogEmbed('memberJoin', {});
    expect(embed.data.timestamp).toBeTruthy();
  });
});
