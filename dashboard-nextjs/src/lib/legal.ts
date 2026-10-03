/**
 * Dane wspólne dla regulaminu (/terms) i polityki prywatności (/privacy).
 *
 * Pola oznaczone TODO muszą zostać uzupełnione PRZED publicznym podlinkowaniem dokumentów
 * (Discord Developer Portal, Stripe, stopka). Art. 5 ust. 2 ustawy o świadczeniu usług drogą
 * elektroniczną wymaga podania imienia, nazwiska, miejsca zamieszkania i adresu usługodawcy —
 * adres może być adresem do korespondencji (np. skrytka pocztowa).
 *
 * Wartości opisujące działanie bota (okresy przechowywania) są zsynchronizowane z kodem:
 *   - GUILD_DATA_RETENTION_DAYS → src/services/guildDataRetentionService.ts (bot)
 *   - ACTIVITY_BUCKET_DAYS      → TTL w src/models/ActivityBucket.ts (bot)
 *   - STREAM_LOG_DAYS           → TTL w src/models/StreamNotificationLog.ts (bot)
 * Zmiana któregokolwiek z nich wymaga aktualizacji dokumentów i podbicia wersji.
 */
export const LEGAL = {
  operatorName: "Dominik Zwoliński",
  /** TODO: miejscowość zamieszkania (samo miasto, bez ulicy). */
  city: "[MIEJSCOWOŚĆ — DO UZUPEŁNIENIA]",
  /** TODO: adres do korespondencji, np. „skrytka pocztowa nr 123, UP Warszawa 1, 00-001 Warszawa". */
  postalAddress: "[ADRES DO KORESPONDENCJI — DO UZUPEŁNIENIA]",
  email: "contact@deezy.cc",
  /** TODO: stałe zaproszenie na serwer wsparcia DeezyBOT. */
  supportServerUrl: "[LINK DO SERWERA WSPARCIA — DO UZUPEŁNIENIA]",
  siteUrl: "https://deezy.cc",
  /** ID aplikacji Discord (to samo co NEXT_PUBLIC_DISCORD_CLIENT_ID w docker-compose.yml). */
  botApplicationId: "1119327417237000285",

  privacyVersion: "1.0",
  termsVersion: "1.0",
  /** Data wejścia w życie (YYYY-MM-DD). */
  effectiveDate: "2026-10-01",

  guildDataRetentionDays: 30,
  defaultWarnExpiryDays: 90,
  activityBucketDays: 32,
  streamLogDays: 60,
  correspondenceRetentionYears: 2,
} as const;

export type LegalLang = "pl" | "en";

export function resolveLegalLang(value: string | string[] | undefined): LegalLang {
  return value === "en" ? "en" : "pl";
}

/** true, gdy któreś pole wymagane prawem nie zostało jeszcze uzupełnione. */
export const LEGAL_HAS_PLACEHOLDERS = [LEGAL.city, LEGAL.postalAddress, LEGAL.supportServerUrl].some((v) =>
  v.startsWith("[")
);
