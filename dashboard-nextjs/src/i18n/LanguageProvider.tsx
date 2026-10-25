"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, type Lang, type Messages, type Widen } from "./config";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: "pl", setLang: () => {} });

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      // Komponenty serwerowe (np. regulamin, metadane) czytają język z ciasteczka.
      router.refresh();
    },
    [router]
  );

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Teksty danego obszaru panelu w bieżącym języku. */
export function useMessages<T>(messages: Messages<T>): Widen<T> {
  const { lang } = useLang();
  return (lang === "en" ? messages.en : messages.pl) as Widen<T>;
}
