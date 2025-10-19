// Removed duplicate minimal embed tests to avoid redeclaration; richer tests retained below.
import { createBaseEmbed, formatResults, formatWarnBar } from '../../../src/utils/embedHelpers';
import { COLORS } from '../../../src/config/constants/colors';

const BOT_ID = '1119327417237000285';

describe('embedHelpers.createBaseEmbed', () => {
  test('sets provided fields and omits undefined', () => {
    const embed = createBaseEmbed({
      title: 'T',
      description: 'D',
      footerText: 'F',
      footerIcon: 'http://x/icon.png',
      image: 'http://x/i.png',
      thumbnail: 'http://x/t.png',
      authorName: 'A',
      authorIcon: 'http://x/a.png',
      authorUrl: 'http://x/a',
      url: 'http://x/u',
      timestamp: true,
      color: '#123456',
    }).toJSON();

    expect(embed.title).toBe('T');
    expect(embed.description).toBe('D');
    expect(embed.footer?.text).toBe('F');
    expect(embed.footer?.icon_url).toBe('http://x/icon.png');
    expect(embed.image?.url).toBe('http://x/i.png');
    expect(embed.thumbnail?.url).toBe('http://x/t.png');
    expect(embed.author?.name).toBe('A');
    expect(embed.author?.icon_url).toBe('http://x/a.png');
    expect(embed.author?.url).toBe('http://x/a');
    expect(embed.url).toBe('http://x/u');
    expect(embed.timestamp).toBeDefined();
    expect(embed.color).toBe(parseInt('#123456'.replace('#', ''), 16));
  });

  test('defaults to error color when isError true and no explicit color', () => {
    const embed = createBaseEmbed({ isError: true, title: 'Err' }).toJSON();
    expect(embed.color).toBe(parseInt(COLORS.ERROR.replace('#', ''), 16));
  });

  test('defaults to base color when nothing provided', () => {
    const embed = createBaseEmbed().toJSON();
    expect(embed.color).toBe(parseInt(COLORS.DEFAULT.replace('#', ''), 16));
  });

  test('omits optional fields when falsy and uses DEFAULT when isError false without color', () => {
    const embed = createBaseEmbed({
      title: 'OnlyTitle',
      description: '', // falsy -> omitted
      footerText: '', // falsy -> omitted
      image: undefined,
      thumbnail: undefined,
      authorName: undefined as any,
      url: undefined,
      // isError not set -> DEFAULT color
    }).toJSON();
    expect(embed.title).toBe('OnlyTitle');
    expect(embed.description).toBeUndefined();
    expect(embed.footer).toBeUndefined();
    expect(embed.image).toBeUndefined();
    expect(embed.thumbnail).toBeUndefined();
    expect(embed.author).toBeUndefined();
    expect(embed.url).toBeUndefined();
    expect(embed.color).toBe(parseInt(COLORS.DEFAULT.replace('#', ''), 16));
  });
});

describe('embedHelpers.formatResults', () => {
  test('renders bar and percentages', () => {
    const out = formatResults(BOT_ID, ['u1', 'u2', 'u3', 'u4'], ['d1']);
    expect(out).toMatch(/👍 4 głosów na tak/);
    expect(out).toMatch(/👎 1 głosów na nie/);
    expect(out).toMatch(/%/);
  });

  test('0 votes shows 0% and builds empty bar', () => {
    const out = formatResults(BOT_ID, [], []);
    expect(out).toMatch(/0 głosów na tak/);
    expect(out).toMatch(/0 głosów na nie/);
  });

  test('100% upvotes -> full bar', () => {
    const cfg = (require('../../../src/config/bot') as any).getBotConfig(BOT_ID);
    const { suggestionPB } = cfg.emojis;
    const out = formatResults(BOT_ID, new Array(5).fill(0).map((_, i) => 'u'+i), []);
    expect(out).toMatch(/100\.0%/);
    expect(out).toMatch(/0\.0%/);
    expect(out).toContain(suggestionPB.lf);
    expect(out).toContain(suggestionPB.rf);
    expect(out).not.toContain(suggestionPB.re);
    const mfCount = (out.match(new RegExp(suggestionPB.mf.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length;
    expect(mfCount).toBeGreaterThanOrEqual(12);
  });

  test('100% downvotes -> empty bar', () => {
    const cfg = (require('../../../src/config/bot') as any).getBotConfig(BOT_ID);
    const { suggestionPB } = cfg.emojis;
    const out = formatResults(BOT_ID, [], ['d1','d2','d3']);
    expect(out).toMatch(/0\.0%/);
    expect(out).toMatch(/100\.0%/);
    expect(out).toContain(suggestionPB.le);
    expect(out).toContain(suggestionPB.re);
    expect(out).not.toContain(suggestionPB.rf);
    const mfCount = (out.match(new RegExp(suggestionPB.mf.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length;
    expect(mfCount).toBe(0);
  });

  test('empty lists snapshot', () => {
    const out = formatResults(BOT_ID, [], []);
    expect(out).toMatchSnapshot('formatResults-empty');
  });

  test('very long lists snapshot (bar length fixed)', () => {
    const ups = Array.from({ length: 900 }, (_, i) => `u${i}`);
    const downs = Array.from({ length: 100 }, (_, i) => `d${i}`);
    const out = formatResults(BOT_ID, ups, downs);
    expect(out).toMatchSnapshot('formatResults-long');
  });
});

describe('embedHelpers.formatWarnBar', () => {
  test('warn bar increases representation of full segments with count', () => {
    const low = formatWarnBar(BOT_ID, 0);
    const mid = formatWarnBar(BOT_ID, 1);
    const high = formatWarnBar(BOT_ID, 3);
    const { warnPB } = (require('../../../src/config/bot') as any).getBotConfig(BOT_ID).emojis;
    const fullToken = warnPB.mf;
    const countFull = (s: string) =>
      (s.match(new RegExp(fullToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const lowFull = countFull(low);
    const midFull = countFull(mid);
    const highFull = countFull(high);
    expect(highFull).toBeGreaterThanOrEqual(midFull);
    expect(midFull).toBeGreaterThanOrEqual(lowFull);
    expect(new Set([low, mid, high]).size).toBeGreaterThan(1);
  });

  test('warn bar caps at max warnings', () => {
    const capped = formatWarnBar(BOT_ID, 999);
    const max = formatWarnBar(BOT_ID, 3);
    expect(capped).toBe(max);
  });

  test('createBaseEmbed + warn bar snapshot', () => {
    const warnBar = formatWarnBar(BOT_ID, 2);
    const embed = createBaseEmbed({
      isError: true,
      title: 'Status ostrzeżeń',
      description: `Ostrzeżenia: ${warnBar}`,
      footerText: 'Serwer XYZ',
      thumbnail: 'http://assets/thumb.png',
      authorName: 'Dyzio',
      authorIcon: 'http://assets/author.png',
    }).toJSON();
    expect(embed).toMatchSnapshot('createBaseEmbed-with-warnbar');
  });
});
