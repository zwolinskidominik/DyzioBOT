import { getLang } from "./server";
import { DEFAULT_LANG, type Lang, type Widen } from "./config";
import { apiMessages } from "./messages/api";

export type ApiText = Widen<typeof apiMessages.pl>;

/**
 * Język panelu dla bieżącego żądania API (ciasteczko `deezy-lang`, inaczej Accept-Language).
 * Poza kontekstem żądania (np. testy wołające handler bezpośrednio) wraca do języka domyślnego.
 */
export async function getRequestLang(): Promise<Lang> {
  try {
    return await getLang();
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * Teksty API w języku panelu z bieżącego żądania. Używaj w route handlerach zamiast pisać
 * komunikaty gołymi stringami (pilnuje tego test apiPolishLiterals).
 */
export async function getApiMessages(): Promise<{ lang: Lang; t: ApiText }> {
  const lang = await getRequestLang();
  return { lang, t: lang === "en" ? apiMessages.en : apiMessages.pl };
}
