import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_HAS_PLACEHOLDERS, type LegalLang } from "@/lib/legal";

interface LegalLayoutProps {
  lang: LegalLang;
  /** Ścieżka bieżącego dokumentu — do linków przełączania języka. */
  path: "/privacy" | "/terms";
  title: string;
  version: string;
  children: ReactNode;
}

const LABELS = {
  pl: {
    back: "Strona główna",
    version: "Wersja",
    effective: "obowiązuje od",
    privacy: "Polityka prywatności",
    terms: "Regulamin",
    draft: "Wersja robocza — dane usługodawcy nie zostały jeszcze uzupełnione.",
  },
  en: {
    back: "Home",
    version: "Version",
    effective: "effective from",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    draft: "Draft — the operator's details have not been filled in yet.",
  },
} as const;

export function LegalLayout({ lang, path, title, version, children }: LegalLayoutProps) {
  const t = LABELS[lang];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← {t.back}
          </Link>
          <nav aria-label="Language" className="flex gap-1 text-sm">
            {(["pl", "en"] as const).map((code) => (
              <Link
                key={code}
                href={code === "pl" ? path : `${path}?lang=en`}
                aria-current={code === lang ? "page" : undefined}
                className={
                  code === lang
                    ? "rounded-md bg-card px-2.5 py-1 font-semibold text-foreground"
                    : "rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {LEGAL_HAS_PLACEHOLDERS && (
          <p role="note" className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {t.draft}
          </p>
        )}
        <h1 className="text-3xl font-bold text-bot-blue">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.version} {version}, {t.effective} {LEGAL.effectiveDate}
        </p>
        <div className="mt-8 space-y-8 break-words text-[15px] leading-7 text-foreground">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          <Link href={lang === "en" ? "/privacy?lang=en" : "/privacy"} className="hover:text-foreground">
            {t.privacy}
          </Link>
          <Link href={lang === "en" ? "/terms?lang=en" : "/terms"} className="hover:text-foreground">
            {t.terms}
          </Link>
          <a href={`mailto:${LEGAL.email}`} className="hover:text-foreground">
            {LEGAL.email}
          </a>
        </div>
      </footer>
    </div>
  );
}

/**
 * Sekcja dokumentu z numerowanym nagłówkiem. Nagłówki w kolorze bota: bot-blue (#818cf8)
 * zamiast bot-primary (#6366f1), bo jaśniejszy odcień tej samej barwy ma lepszy kontrast
 * na ciemnym tle.
 */
export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl font-semibold text-bot-blue">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6 marker:text-muted-foreground">{children}</ul>;
}

/** Wyróżnione słowo kluczowe w treści (bez zmiany koloru spoza tokenów). */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

/** Link zewnętrzny albo placeholder, jeśli adres nie jest jeszcze uzupełniony. */
export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  if (href.startsWith("[")) return <span>{href}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">
      {children ?? href}
    </a>
  );
}
