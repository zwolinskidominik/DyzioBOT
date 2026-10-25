/**
 * Języki panelu. Wybór trzymamy w ciasteczku (ustawiane przełącznikiem w nawigacji);
 * bez ciasteczka bierzemy język przeglądarki: polski → PL, każdy inny → EN.
 */
export const LANGS = ["pl", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "pl";
export const LANG_COOKIE = "deezy-lang";
/** Rok - wybór języka ma przetrwać wylogowanie i zamknięcie przeglądarki. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** Pierwszy język z nagłówka Accept-Language (np. "pl-PL,pl;q=0.9,en;q=0.8" → "pl"). */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return DEFAULT_LANG;
  return first.startsWith("pl") ? "pl" : "en";
}

export function resolveLang(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Lang {
  return isLang(cookieValue) ? cookieValue : langFromAcceptLanguage(acceptLanguage);
}

/** Słownik: polska wersja jest źródłem, angielska musi mieć dokładnie te same klucze. */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };

export interface Messages<T> {
  pl: T;
  en: Widen<T>;
}

/** Definicja słownika jednego obszaru panelu; TypeScript pilnuje, żeby EN miał wszystkie klucze PL. */
export function defineMessages<T>(messages: Messages<T>): Messages<T> {
  return messages;
}
