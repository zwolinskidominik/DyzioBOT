jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const findOne = jest.fn();
const findOneAndUpdate = jest.fn();
jest.mock('../../../src/models/GuildSettings', () => ({
  GuildSettingsModel: {
    findOne: (...args: unknown[]) => findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
  },
}));

import { Locale } from 'discord.js';
import { isLang, langFromDiscordLocale, plural, pluralEn, intlLocale } from '../../../src/i18n';
import { CACHE_TTL_MS, clearGuildLanguageCache, getGuildLanguage, initGuildLanguage } from '../../../src/i18n/guildLanguage';
import { ALL_CATALOGS } from '../../../src/i18n/catalogs';
import { commonMessages } from '../../../src/i18n/messages/common';

/** Zapytanie Mongoose: findOne(...).select(...).lean() */
function query(result: unknown) {
  return { select: () => ({ lean: () => Promise.resolve(result) }) };
}

describe('language helpers', () => {
  it('maps Discord locales: Polish to pl, everything else to en', () => {
    expect(langFromDiscordLocale('pl')).toBe('pl');
    expect(langFromDiscordLocale('en-US')).toBe('en');
    expect(langFromDiscordLocale('de')).toBe('en');
    expect(langFromDiscordLocale(undefined)).toBe('en');
    expect(isLang('en')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(intlLocale('en')).toBe('en-US');
  });

  it.each([
    [1, 'sekundę'],
    [2, 'sekundy'],
    [4, 'sekundy'],
    [5, 'sekund'],
    [12, 'sekund'],
    [22, 'sekundy'],
    [25, 'sekund'],
    [0, 'sekund'],
  ])('Polish plural for %i', (n, expected) => {
    expect(plural(n, ['sekundę', 'sekundy', 'sekund'])).toBe(expected);
  });

  it('English plural', () => {
    expect(pluralEn(1, 'second', 'seconds')).toBe('second');
    expect(pluralEn(3, 'second', 'seconds')).toBe('seconds');
  });

  it('formats messages with parameters in both languages', () => {
    expect(commonMessages.pl.cooldown(3)).toBe('Odczekaj jeszcze 3 sekundy przed ponownym użyciem tej komendy.');
    expect(commonMessages.en.cooldown(1)).toBe('Please wait 1 more second before using this command again.');
  });
});

describe('getGuildLanguage / initGuildLanguage', () => {
  beforeEach(() => {
    clearGuildLanguageCache();
    findOne.mockReset();
    findOneAndUpdate.mockReset();
  });

  it('reads the saved language and caches it for a minute', async () => {
    findOne.mockReturnValue(query({ language: 'en' }));
    await expect(getGuildLanguage('g1', 1_000)).resolves.toBe('en');
    await expect(getGuildLanguage('g1', 1_000 + CACHE_TTL_MS - 1)).resolves.toBe('en');
    expect(findOne).toHaveBeenCalledTimes(1);
    findOne.mockReturnValue(query({ language: 'pl' }));
    await expect(getGuildLanguage('g1', 1_000 + CACHE_TTL_MS)).resolves.toBe('pl');
  });

  it('falls back to Polish without settings, for DMs, unknown values and database errors', async () => {
    findOne.mockReturnValue(query(null));
    await expect(getGuildLanguage('g2')).resolves.toBe('pl');
    await expect(getGuildLanguage(null)).resolves.toBe('pl');
    findOne.mockReturnValue(query({ language: 'de' }));
    await expect(getGuildLanguage('g3')).resolves.toBe('pl');
    findOne.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(getGuildLanguage('g4')).resolves.toBe('pl');
  });

  it('sets the language of a new server from its Discord locale, only on first join', async () => {
    findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ language: 'en' }) });
    await expect(initGuildLanguage({ id: 'g5', preferredLocale: Locale.EnglishUS })).resolves.toBe('en');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { guildId: 'g5' },
      { $setOnInsert: { guildId: 'g5', language: 'en' } },
      expect.objectContaining({ upsert: true })
    );
    // Wynik trafia do pamięci podręcznej - bez dodatkowego zapytania.
    await expect(getGuildLanguage('g5')).resolves.toBe('en');
    expect(findOne).not.toHaveBeenCalled();
  });
});

/** Klucze słownika w postaci ścieżek, np. "nested.key". Funkcje traktujemy jak liście. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string' || typeof value === 'function') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

/** Wszystkie teksty słownika; funkcje wywołujemy z przykładowymi argumentami. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String(value(2, 'X', 'Y', 'Z'))];
  if (value && typeof value === 'object') return Object.values(value).flatMap(texts);
  return [];
}

describe.each(Object.entries(ALL_CATALOGS))('catalog %s', (_name, catalog) => {
  it('has the same keys in Polish and English', () => {
    expect(keyPaths(catalog.en).sort()).toEqual(keyPaths(catalog.pl).sort());
  });

  it('has no Polish letters in the English version', () => {
    const polish = texts(catalog.en).filter((text) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text));
    expect(polish).toEqual([]);
  });
});
