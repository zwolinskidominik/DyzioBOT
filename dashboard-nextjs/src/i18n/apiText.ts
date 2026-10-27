import { useCallback } from "react";
import type { Lang } from "./config";
import { useLang } from "./LanguageProvider";
import { logEventTextEn } from "./messages/logs";

/**
 * Tłumaczenie tekstów, które przychodzą z API lub z bazy po polsku: opisy i etykiety zmian w logach panelu
 * (zapisane w chwili zmiany, więc stare wpisy też trzeba przetłumaczyć przy odczycie), powody problemów
 * z modułami, nazwy grup emoji i komunikaty błędów API. Tekst bez dopasowania zwracamy bez zmian
 * (np. nazwy kanałów, treści wpisane przez użytkownika).
 */

/** Polskie nazwy zdarzeń logów, tak jak zapisuje je API logów (EVENT_LABELS w logs/config/route.ts). */
const LOG_EVENT_NAMES_PL: Record<string, string> = {
  memberBan: "Zbanowanie członka",
  memberUnban: "Odbanowanie członka",
  memberKick: "Wyrzucenie członka",
  memberTimeout: "Wyciszenie",
  moderationCommand: "Komenda moderacyjna",
  antiSpam: "Anti-Spam",
  messageDelete: "Usunięcie wiadomości",
  messageEdit: "Edycja wiadomości",
  memberJoin: "Członek dołączył",
  memberLeave: "Członek opuścił",
  memberNicknameChange: "Zmiana pseudonimu",
  memberRoleAdd: "Nadanie roli",
  memberRoleRemove: "Usunięcie roli",
  voiceJoin: "Dołączył do VC",
  voiceLeave: "Opuścił VC",
  voiceMove: "Przełączył kanał VC",
  voiceDisconnect: "Odłączony od VC",
  voiceMemberMove: "Przeniesiony do VC",
  voiceStateChange: "Stan głosu",
  channelCreate: "Utworzenie kanału",
  channelDelete: "Usunięcie kanału",
  channelUpdate: "Aktualizacja kanału",
  channelPermissionUpdate: "Aktualizacja uprawnień",
  threadCreate: "Tworzenie wątku",
  threadDelete: "Usuwanie wątku",
  threadUpdate: "Aktualizacja wątku",
  roleCreate: "Utworzenie roli",
  roleDelete: "Usunięcie roli",
  roleUpdate: "Aktualizacja roli",
  guildUpdate: "Aktualizacja serwera",
  inviteCreate: "Wysłano zaproszenie",
};

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

  // Powody problemów z modułami (modules-status/issues)
  "Brak wybranego kanału na ogłoszenia urodzin": "No channel picked for birthday announcements",
  "Brak wybranego kanału powitań": "No welcome channel picked",
  "Brak wybranego kanału na pytanie dnia": "No channel picked for the Question of the Day",
  "Brak wybranego kanału na publikację rankingu": "No channel picked for posting the ranking",
  "Brak wybranych ról do nadawania": "No roles picked to give",
  "Brak wybranego kanału na sugestie": "No channel picked for suggestions",
  "Brak wybranej kategorii na tickety": "No category picked for tickets",
  "Brak wybranego kanału na Server Wrapped": "No channel picked for Server Wrapped",
  "Brak wybranego kanału na przypomnienia": "No channel picked for reminders",
  "Brak wybranego kanału powiadomień": "No notification channel picked",
  "Brak wybranego kanału dla jakiegokolwiek zdarzenia": "No channel picked for any event",
  "Brak żadnego panelu ról za reakcje": "No reaction role panels yet",

  // Grupy emoji bota (EMOJI_GROUP_LABELS)
  Nawigacja: "Navigation",
  Urodziny: "Birthdays",
  Boosty: "Boosts",
  Powitania: "Greetings",
  "Statystyki miesięczne": "Monthly statistics",
  Sugestie: "Suggestions",
  "Pasek postępu sugestii": "Suggestion progress bar",
  Podium: "Podium",
  "Pasek ostrzeżeń": "Warning bar",
  "Bez odwołania": "Not referenced",

  // Błędy API
  "Błąd serwera": "Server error",
  "Nieprawidłowe dane konfiguracji": "Invalid settings data",
  "Nieprawidłowe dane": "Invalid data",
  "Nie znaleziono kategorii": "Category not found",
  "Nie znaleziono": "Not found",
  "Kategoria o tej nazwie już istnieje": "A category with this name already exists",
  "To słowo już istnieje w bazie": "This word already exists",
  "Tej akcji nie da się cofnąć.": "This action can't be undone.",
  "Ta kara została już cofnięta.": "This punishment has already been undone.",
  "Słowo może zawierać tylko polskie litery (bez q, v, x)": "The word can only contain Polish letters (no q, v, x)",
  "Ostrzeżenie już nie istnieje (mogło wygasnąć lub zostać usunięte wcześniej).": "The warning no longer exists (it may have expired or been removed earlier).",
  "Nieznana akcja": "Unknown action",
  "Nie znaleziono wpisu.": "Entry not found.",
  "Nie znaleziono użytkownika.": "User not found.",
  "Nie znaleziono tego ostrzeżenia.": "This warning wasn't found.",
  "Nie znaleziono słowa": "Word not found",
  "Nie znaleziono przedmiotu": "Item not found",
  "Nie zalogowany": "Not logged in",
  "Nie udało się zdjąć wyciszenia.": "Couldn't remove the timeout.",
  "Nie udało się odbanować użytkownika.": "Couldn't unban the user.",
  "Brakujące pola": "Missing fields",
  "Brak powiązanego wpisu ostrzeżenia.": "No linked warning entry.",
  "Brak dostępu": "No access",
  "Zmiana profilu bota będzie dostępna wkrótce.": "Changing the bot profile will be available soon.",
  "Brak zapisanej konfiguracji ticketów": "No saved ticket settings",
  "Wybierz najpierw kanał panelu": "Pick the panel channel first",
  "Wymagane pole: word": "Required field: word",
  "Wymagane: categoryName, word": "Required: categoryName, word",
  "Wymagane: name, emoji": "Required: name, emoji",
  "Wymagane: names (tablica stringów)": "Required: names (array of strings)",

  // Kroki drabinki ostrzeżeń zapisywane przez bota
  "Brak dodatkowej kary": "No extra punishment",
  "Wyrzucenie z serwera": "Kick from the server",
  "Permanentny ban": "Permanent ban",
};

/** Dopasowania z parametrami (opisy z liczbami, etykiety zdarzeń logów, błędy z wartościami). */
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
  {
    re: /^Panel wdrożony, ale usunięto nieprawidłowe emoji \(prawdopodobnie skasowane z serwera\) z: (.+)\. Wybierz nowe emoji dla (?:tego typu|tych typów) w edycji\.$/,
    to: (names) => `Panel deployed, but invalid emojis (probably deleted from the server) were removed from: ${names}. Pick new emojis for them in the editor.`,
  },
  // Dopiski w historii kar zapisywane przez bota (formatDurationPl, /clear, kroki drabinki ostrzeżeń)
  { re: /^(\d+) (minutę|minuty|minut|min)$/, to: (n) => `${n} min` },
  { re: /^(\d+) (godzinę|godziny|godzin)$/, to: (n) => `${n} ${n === "1" ? "hour" : "hours"}` },
  { re: /^(\d+) (dzień|dni)$/, to: (n) => `${n} ${n === "1" ? "day" : "days"}` },
  { re: /^(\d+) wiadomości$/, to: (n) => `${n} ${n === "1" ? "message" : "messages"}` },
  { re: /^Słowo musi mieć od (\d+) do (\d+) liter$/, to: (a, b) => `The word must have ${a} to ${b} letters` },
  { re: /^Obraz \((.+)\) jest za duży \(max 8 MB\)$/, to: (l) => `The image (${l}) is too large (max 8 MB)` },
  { re: /^Nieprawidłowy format obrazu \((.+)\)$/, to: (l) => `Invalid image format (${l})` },
  { re: /^Nie udało się pobrać profilu bota z Discorda \((\d+)\)$/, to: (s) => `Couldn't fetch the bot profile from Discord (${s})` },
  { re: /^Discord odrzucił panel \((\d+)\): (.*)$/s, to: (s, rest) => `Discord rejected the panel (${s}): ${rest}` },
  { re: /^To emoji jest wpisane w config bota \((.+)\) — usuń najpierw odwołanie w kodzie\.$/, to: (k) => `This emoji is set in the bot config (${k}), remove the reference in the code first.` },
  { re: /^Użytkownik Twitch „(.+)["”] nie istnieje\.?$/, to: (n) => `Twitch user "${n}" doesn't exist.` },
  { re: /^Kanał „(.+)["”] jest już na liście\.?$/, to: (n) => `The channel "${n}" is already on the list.` },
];

export function translateApiText(text: string | null | undefined, lang: Lang): string {
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

/** Etykiety dat z API w formacie DD.MM (np. wykres na stronie głównej) w formacie języka panelu. */
export function translateDayLabel(label: string, lang: Lang): string {
  if (lang !== "en") return label;
  const match = label.match(/^(\d{2})\.(\d{2})$/);
  if (!match) return label;
  const date = new Date(2000, Number(match[2]) - 1, Number(match[1]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Funkcja tłumacząca teksty z API na język panelu (do użycia w komponentach klienckich). */
export function useApiText(): (text: string | null | undefined) => string {
  const { lang } = useLang();
  return useCallback((text: string | null | undefined) => translateApiText(text, lang), [lang]);
}
