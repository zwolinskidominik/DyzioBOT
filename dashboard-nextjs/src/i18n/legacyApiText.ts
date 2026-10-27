import type { Lang } from "./config";
import { logEventTextEn } from "./messages/logs";
import { LOG_EVENT_NAMES_PL } from "./messages/auditEntries";

/**
 * TYLKO dla danych zapisanych wcześniej po polsku: starsze wpisy logów panelu (sprzed zapisu kodów
 * descriptionKey/labelKey) i dopiski w historii kar, które zapisuje bot. Nowe teksty API NIE trafiają
 * tutaj: route'y zwracają je już w języku panelu (getApiMessages), a logi panelu zapisują kody.
 * Używane po stronie serwera (route'y audit-logs i moderation/log). Tekst bez dopasowania zostaje bez zmian.
 */

const LOG_EVENT_PL_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(LOG_EVENT_NAMES_PL).map(([key, pl]) => [pl, logEventTextEn[key]?.name ?? pl])
);

/** Klucze kategorii kanałów z licznikami zapisywane w opisach wpisów logu panelu. */
const COUNTER_CATEGORY_EN: Record<string, string> = {
  lastJoined: "latest member",
  users: "member count",
  bots: "bot count",
  bans: "ban count",
};

/** Dokładne dopasowania PL -> EN. */
const EXACT_EN: Record<string, string> = {
  // Opisy wpisów logu panelu
  "Zaktualizowano profil bota na tym serwerze": "Updated the bot profile on this server",
  "Zaktualizowano ustawienia ogólne serwera": "Updated the server's general settings",
  "Zaktualizowano konfigurację kanałów ze statystykami": "Updated the counter channel settings",
  "Zaktualizowano konfigurację giveawayów": "Updated the giveaway settings",
  "Zaktualizowano konfigurację systemu poziomów": "Updated the level system settings",
  "Zaktualizowano konfigurację turnieju": "Updated the tournament settings",
  "Zaktualizowano konfigurację Server Wrapped": "Updated the Server Wrapped settings",
  "Usunięto konfigurację kanałów tymczasowych": "Deleted the temporary channel settings",
  "Wiadomości o awansie": "Level-up messages",

  // Etykiety zmian
  "Avatar bota": "Bot avatar",
  "Banner bota": "Bot banner",
  "Nazwa bota": "Bot name",
  "Opis bota": "Bot bio",
  "Język bota": "Bot language",
  "Kanał powiadomień systemowych": "System notification channel",
  "ID wiadomości panelu": "Panel message ID",
  "Kanał panelu": "Panel channel",
  "Kategoria": "Category",
  "Liczba typów ticketów": "Ticket type count",
  "Włączony": "Enabled",
  "Cooldown (s)": "Cooldown (s)",
  "Dodatkowa notatka": "Extra note",
  "Embed przy dołączeniu": "Embed on join",
  "Embed przy opuszczeniu": "Embed on leave",
  "Emoji reakcji": "Reaction emoji",
  "Harmonogram (cron)": "Schedule (cron)",
  "Ignorowane kanały": "Ignored channels",
  "Ignorowane role": "Ignored roles",
  "Kanał głosowy": "Voice channel",
  "Kanał logów dołączeń": "Join log channel",
  "Kanał logów opuszczeń": "Leave log channel",
  "Kanał ogłoszeń": "Announcement channel",
  "Kanał powiadomień": "Notification channel",
  "Kanał": "Channel",
  "Kanał: liczba banów": "Channel: ban count",
  "Kanał: liczba botów": "Channel: bot count",
  "Kanał: liczba użytkowników": "Channel: member count",
  "Kanał: ostatnio dołączył": "Channel: latest member",
  "Ostatnio dołączył": "Latest member",
  "Liczba użytkowników": "Member count",
  "Liczba botów": "Bot count",
  "Liczba banów": "Ban count",
  "Kolor embeda": "Embed color",
  "Kolor karty": "Card color",
  "Liczba kanałów": "Channel count",
  "Liczba kreatorów": "Creator count",
  "Liczba mnożników kanałów": "Channel multiplier count",
  "Liczba mnożników ról": "Role multiplier count",
  "Liczba nagród za poziom": "Level reward count",
  "Liczba organizatorów": "Organizer count",
  "Moduł logów włączony": "Log module enabled",
  "Motyw kolorystyczny": "Color theme",
  "Odznaka rangi": "Rank badge",
  "Powiadomienia o dołączeniu": "Join notifications",
  "Powiadomienia o opuszczeniu": "Leave notifications",
  "Rola organizatora": "Organizer role",
  "Rola uczestnika": "Participant role",
  "Stopka": "Footer",
  "Szablon wiadomości": "Message template",
  "Treść wiadomości o nagrodzie": "Reward message text",
  "Treść wiadomości o poziomie": "Level message text",
  "Tryb wiadomości": "Message mode",
  "Tytuł": "Title",
  "Usuwanie poprzednich nagród": "Remove previous rewards",
  "Wiadomość o nagrodzie": "Reward message",
  "Wiadomość o poziomie": "Level message",
  "XP za minutę na kanale głosowym": "XP per minute in voice",
  "XP za wiadomość": "XP per message",

  // Wartości zmian
  brak: "none",
  "włączone": "on",
  "wyłączone": "off",
  "włączony": "on",
  "wyłączony": "off",
  zmieniono: "changed",
  "usunięto": "removed",
  "domyślny": "default",
  pl: "Polish",
  en: "English",

  // Kroki drabinki ostrzeżeń zapisywane przez bota
  "Brak dodatkowej kary": "No extra punishment",
  "Wyrzucenie z serwera": "Kick from the server",
  "Permanentny ban": "Permanent ban",
};

/** Dopasowania z parametrami (opisy z liczbami, etykiety zdarzeń logów, dopiski kar). */
const PATTERNS_EN: { re: RegExp; to: (...groups: string[]) => string }[] = [
  { re: /^Zaktualizowano konfigurację logów \((\d+) (?:zmiana|zmian|zmiany)\)$/, to: (n) => `Updated the log settings (${n} ${n === "1" ? "change" : "changes"})` },
  { re: /^Zaktualizowano konfigurację ticketów \((\d+) (?:typ|typów|typy)\)$/, to: (n) => `Updated the ticket settings (${n} ${n === "1" ? "type" : "types"})` },
  { re: /^Wdrożono panel ticketów na Discord \((\d+) typów\)$/, to: (n) => `Deployed the ticket panel to Discord (${n} ${n === "1" ? "type" : "types"})` },
  { re: /^Zaktualizowano kanały tymczasowe \((\d+) kanałów\)$/, to: (n) => `Updated temporary channels (${n} ${n === "1" ? "channel" : "channels"})` },
  { re: /^Zaktualizowano konfigurację Invite Trackera \(enabled: (true|false)\)$/, to: (on) => `Updated the Invite Tracker settings (${on === "true" ? "on" : "off"})` },
  { re: /^Utworzono kanał statystyk: (.+)$/, to: (c) => `Created a counter channel: ${COUNTER_CATEGORY_EN[c] ?? c}` },
  { re: /^Usunięto kanał statystyk: (.+)$/, to: (c) => `Deleted a counter channel: ${COUNTER_CATEGORY_EN[c] ?? c}` },
  { re: /^Wyzerowano saldo WSZYSTKICH użytkowników na serwerze \((\d+) kont\)$/, to: (n) => `Wiped the balance of ALL members on the server (${n} accounts)` },
  { re: /^Zresetowano poziomy WSZYSTKICH użytkowników na serwerze \(usunięto (\d+) rekordów\)$/, to: (n) => `Reset the levels of ALL members on the server (${n} records removed)` },
  { re: /^Zresetowano ostrzeżenia WSZYSTKICH użytkowników na serwerze \(usunięto (\d+) rekordów\)$/, to: (n) => `Reset the warnings of ALL members on the server (${n} records removed)` },
  {
    re: /^(.+): (logowanie|kanał|kolor)$/,
    to: (event, part) => {
      const name = LOG_EVENT_PL_TO_EN[event] ?? EXACT_EN[event] ?? event;
      return `${name}: ${part === "logowanie" ? "logging" : part === "kanał" ? "channel" : "color"}`;
    },
  },
  // Dopiski w historii kar zapisywane przez bota (formatDurationPl, /clear, kroki drabinki ostrzeżeń)
  { re: /^(\d+) (minutę|minuty|minut|min)$/, to: (n) => `${n} min` },
  { re: /^(\d+) (godzinę|godziny|godzin)$/, to: (n) => `${n} ${n === "1" ? "hour" : "hours"}` },
  { re: /^(\d+) (dzień|dni)$/, to: (n) => `${n} ${n === "1" ? "day" : "days"}` },
  { re: /^(\d+) wiadomości$/, to: (n) => `${n} ${n === "1" ? "message" : "messages"}` },
];

export function translateLegacyText(text: string | null | undefined, lang: Lang): string {
  if (text === null || text === undefined) return "";
  if (lang !== "en" || text === "") return text;
  const exact = EXACT_EN[text] ?? LOG_EVENT_PL_TO_EN[text];
  if (exact) return exact;
  for (const { re, to } of PATTERNS_EN) {
    const match = text.match(re);
    if (match) return to(...match.slice(1));
  }
  return text;
}
