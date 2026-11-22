/**
 * Tłumaczenia bota. Język wybiera serwer (GuildSettings.language, ustawiany w dashboardzie);
 * nowe serwery dostają go z języka serwera w Discordzie (guild.preferredLocale).
 *
 * Słowniki są zwykłymi obiektami TS per moduł (src/i18n/messages/*), definiowanymi przez
 * defineMessages(): polska wersja jest wzorem, a angielska musi mieć dokładnie te same klucze
 * i te same parametry funkcji - brakujące tłumaczenie to błąd typecheck, więc nie da się go wdrożyć.
 *
 *   const m = commonMessages[lang];
 *   m.cooldown(5) // "Poczekaj jeszcze 5 sekund." / "Please wait 5 more seconds."
 */

export const LANGS = ['pl', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Istniejące serwery (bez zapisanego języka) zostają przy polskim. */
export const DEFAULT_LANG: Lang = 'pl';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Język Discorda (np. 'pl', 'en-US', 'de') → język bota: polski albo angielski dla wszystkich innych. */
export function langFromDiscordLocale(locale: string | null | undefined): Lang {
  return locale?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/** Słownik: polska wersja jest źródłem, angielska musi mieć ten sam kształt. */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };

export interface Messages<T> {
  pl: T;
  en: Widen<T>;
}

export function defineMessages<T>(messages: Messages<T>): Messages<T> {
  return messages;
}

/**
 * Polska odmiana po liczebniku: 1 → forms[0], 2-4 (poza 12-14) → forms[1], reszta → forms[2].
 * plural(5, ['sekundę', 'sekundy', 'sekund']) === 'sekund'
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const last2 = abs % 100;
  if (abs === 1) return forms[0];
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return forms[1];
  return forms[2];
}

/** Angielska odmiana: 1 → one, reszta → other. */
export function pluralEn(n: number, one: string, other: string): string {
  return Math.abs(n) === 1 ? one : other;
}

/** Locale do Intl (daty, liczby) dla języka bota. */
export function intlLocale(lang: Lang): string {
  return lang === 'pl' ? 'pl-PL' : 'en-US';
}
