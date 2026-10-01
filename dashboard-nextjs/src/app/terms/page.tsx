import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { TermsEn } from "@/components/legal/TermsEn";
import { TermsPl } from "@/components/legal/TermsPl";
import { LEGAL, resolveLegalLang } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Regulamin · Terms of Service — Deezy",
};

interface PageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

/** Publiczna strona (bez logowania) — wyjątek w matcherze src/proxy.ts. */
export default async function TermsPage({ searchParams }: PageProps) {
  const lang = resolveLegalLang((await searchParams).lang);
  return (
    <LegalLayout
      lang={lang}
      path="/terms"
      title={lang === "en" ? "Terms of Service" : "Regulamin"}
      version={LEGAL.termsVersion}
    >
      {lang === "en" ? <TermsEn /> : <TermsPl />}
    </LegalLayout>
  );
}
