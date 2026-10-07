import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { PrivacyEn } from "@/components/legal/PrivacyEn";
import { PrivacyPl } from "@/components/legal/PrivacyPl";
import { LEGAL, resolveLegalLang } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Polityka prywatności · Privacy Policy — Deezy",
};

interface PageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

/** Publiczna strona (bez logowania) — wyjątek w matcherze src/proxy.ts. */
export default async function PrivacyPage({ searchParams }: PageProps) {
  const lang = resolveLegalLang((await searchParams).lang);
  return (
    <LegalLayout
      lang={lang}
      path="/privacy"
      title={lang === "en" ? "Privacy Policy" : "Polityka prywatności"}
      version={LEGAL.privacyVersion}
      effectiveDate={LEGAL.privacyEffectiveDate}
    >
      {lang === "en" ? <PrivacyEn /> : <PrivacyPl />}
    </LegalLayout>
  );
}
