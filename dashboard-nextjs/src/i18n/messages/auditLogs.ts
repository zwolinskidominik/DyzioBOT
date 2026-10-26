import { defineMessages } from "../config";

/** Polska odmiana liczebnikowa: 1 / 2-4 / 5+. */
function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

/** Logi panelu (/[guildId]/audit-logs). Opisy i etykiety zmian przychodzą z API (na razie po polsku). */
export const auditLogsMessages = defineMessages({
  pl: {
    title: "Logi panelu kontrolnego",
    subtitle: "Historia wszystkich zmian dokonanych w panelu administracyjnym",
    loadError: "Nie udało się załadować logów panelu kontrolnego.",
    modules: {
      levels: "System poziomów",
      tickets: "Tickety",
      channel_stats: "Kanały z licznikami",
      wrapped: "Server Wrapped",
      giveaway: "Giveaway",
      tournament: "Turniej",
      temp_channels: "Tymczasowe kanały",
      "invite-tracker": "Invite Tracker",
      logs: "Logi",
    },
    ranges: { "7": "Ostatnie 7 dni", "30": "Ostatnie 30 dni", "90": "Ostatnie 90 dni", all: "Cały czas" },
    justNow: "przed chwilą",
    minutesAgo: (n: number) => `${n} ${plPlural(n, "minutę", "minuty", "minut")} temu`,
    hoursAgo: (n: number) => `${n} ${plPlural(n, "godzinę", "godziny", "godzin")} temu`,
    daysAgo: (n: number) => `${n} ${plPlural(n, "dzień", "dni", "dni")} temu`,
    today: "Dzisiaj",
    yesterday: "Wczoraj",
    valueNone: "brak",
    valueOn: "włączone",
    valueOff: "wyłączone",
    searchPlaceholder: "Szukaj po użytkowniku, akcji lub opisie...",
    allModules: "Wszystkie moduły",
    clear: "Wyczyść",
    found: (n: number) => `Znaleziono: ${n}`,
    noMatches: "Brak logów spełniających kryteria filtrowania",
    empty: "Brak logów panelu kontrolnego",
    entries: (n: number) => `${n} ${plPlural(n, "wpis", "wpisy", "wpisów")}`,
    newest: "Najnowszy",
    more: (n: number) => `+${n} więcej`,
    collapse: "zwiń",
    rawDetails: "Szczegóły (starszy wpis, bez zapisanych wartości from/to)",
    perPage: "Na stronę:",
  },
  en: {
    title: "Dashboard audit log",
    subtitle: "History of every change made in the dashboard",
    loadError: "Couldn't load the dashboard audit log.",
    modules: {
      levels: "Levels",
      tickets: "Tickets",
      channel_stats: "Counter channels",
      wrapped: "Server Wrapped",
      giveaway: "Giveaway",
      tournament: "Tournament",
      temp_channels: "Temporary channels",
      "invite-tracker": "Invite Tracker",
      logs: "Logs",
    },
    ranges: { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" },
    justNow: "just now",
    minutesAgo: (n: number) => `${n} ${n === 1 ? "minute" : "minutes"} ago`,
    hoursAgo: (n: number) => `${n} ${n === 1 ? "hour" : "hours"} ago`,
    daysAgo: (n: number) => `${n} ${n === 1 ? "day" : "days"} ago`,
    today: "Today",
    yesterday: "Yesterday",
    valueNone: "none",
    valueOn: "on",
    valueOff: "off",
    searchPlaceholder: "Search by user, action or description...",
    allModules: "All modules",
    clear: "Clear",
    found: (n: number) => `Found: ${n}`,
    noMatches: "No entries match the filters",
    empty: "No dashboard log entries yet",
    entries: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    newest: "Newest",
    more: (n: number) => `+${n} more`,
    collapse: "collapse",
    rawDetails: "Details (older entry, no from/to values saved)",
    perPage: "Per page:",
  },
});
