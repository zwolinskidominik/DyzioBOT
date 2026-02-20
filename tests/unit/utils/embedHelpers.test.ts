import { createBaseEmbed, createErrorEmbed } from '../../../src/utils/embedHelpers';

/* ── createBaseEmbed ──────────────────────────────────────── */

describe('createBaseEmbed', () => {
  it('creates embed with default color when no options', () => {
    const embed = createBaseEmbed();
    expect(embed.data.color).toBeTruthy();
  });

  it('sets title and description', () => {
    const embed = createBaseEmbed({ title: 'Test', description: 'Desc' });
    expect(embed.data.title).toBe('Test');
    expect(embed.data.description).toBe('Desc');
  });

  it('uses error color when isError is true', () => {
    const normal = createBaseEmbed();
    const error = createBaseEmbed({ isError: true });
    expect(error.data.color).not.toBe(normal.data.color);
  });

  it('sets footer text and icon', () => {
    const embed = createBaseEmbed({ footerText: 'foot', footerIcon: 'https://example.com/icon.png' });
    expect(embed.data.footer?.text).toBe('foot');
    expect(embed.data.footer?.icon_url).toBe('https://example.com/icon.png');
  });

  it('sets author fields', () => {
    const embed = createBaseEmbed({
      authorName: 'Auth',
      authorIcon: 'https://example.com/a.png',
      authorUrl: 'https://example.com',
    });
    expect(embed.data.author?.name).toBe('Auth');
  });
});

/* ── createErrorEmbed ─────────────────────────────────────── */

describe('createErrorEmbed', () => {
  it('prefixes description with ❌', () => {
    const embed = createErrorEmbed('Something failed');
    expect(embed.data.description).toBe('❌ Something failed');
  });

  it('uses error color', () => {
    const error = createErrorEmbed('err');
    const normal = createBaseEmbed();
    expect(error.data.color).not.toBe(normal.data.color);
  });
});
