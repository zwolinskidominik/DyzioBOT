import { defineMessages } from '../index';

/** /help: opisy komend i teksty embeda. Klucze opisów = nazwy komend. */
export const helpMessages = defineMessages({
  pl: {
    title: '📚 Lista komend - Deezy',
    legend:
      '**Legenda:**\n' +
      '`<parametr>` - wymagany\n' +
      '`[parametr]` - opcjonalny\n' +
      '`@użytkownik` - wzmianka użytkownika\n' +
      '⸻⸻⸻⸻⸻⸻⸻⸻⸻\n' +
      '**Dostępne komendy:**',
    userPlaceholder: '@użytkownik',
    footer: (page: number, total: number) => `Strona ${page}/${total} • Komendy alfabetycznie`,
    usage: 'Użycie',
    contactTitle: '📬 Pomoc i kontakt',
    contact: (supportUrl: string, email: string) =>
      `Pytania i problemy z botem: [serwer wsparcia](${supportUrl}). Zgłoszenie nadużycia albo prośba o usunięcie danych: **${email}**`,
    buttons: { panel: 'Panel', support: 'Serwer wsparcia', terms: 'Regulamin', privacy: 'Polityka prywatności', status: 'Status' },
    error: 'Wystąpił błąd podczas wyświetlania pomocy.',
    descriptions: {
      avatar: 'Wyświetla avatar użytkownika w pełnej rozdzielczości.',
      birthday: 'Pokazuje twoją zapisaną datę urodzin lub innego użytkownika.',
      'birthday-remember': 'Zapisuje twoją datę urodzin (format: DD-MM-RRRR lub DD-MM).',
      'birthdays-next': 'Wyświetla listę 10 najbliższych urodzin użytkowników na serwerze.',
      cat: 'Wysyła losowe zdjęcie kota. 🐱',
      dog: 'Wysyła losowe zdjęcie psa. 🐶',
      emoji: 'Pokazuje listę wszystkich dostępnych emoji na serwerze.',
      faceit: 'Wyświetla statystyki gracza CS2 z platformy FACEIT.',
      level: 'Pokazuje twój poziom (XP) lub innego użytkownika.',
      meme: 'Wysyła losowego mema z polskich stron (kwejk, demotywatory, mistrzowie, ivall).',
      ping: 'Sprawdza opóźnienie bota (ping).',
      roll: 'Rzuć kostką - losuje liczbę z zakresu od 1 do N (domyślnie: 1-6).',
      serverinfo: 'Wyświetla szczegółowe informacje o serwerze.',
      toplvl: 'Pokazuje ranking użytkowników według poziomu (top 10 na stronę).',
      warnings: 'Wyświetla twoje ostrzeżenia lub ostrzeżenia innego użytkownika.',
      minecraft: 'Panel serwera Minecraft: stan, gracze, uruchamianie serwera i whitelista.',
    },
  },
  en: {
    title: '📚 Command list - Deezy',
    legend:
      '**Legend:**\n' +
      '`<parameter>` - required\n' +
      '`[parameter]` - optional\n' +
      '`@user` - user mention\n' +
      '⸻⸻⸻⸻⸻⸻⸻⸻⸻\n' +
      '**Available commands:**',
    userPlaceholder: '@user',
    footer: (page: number, total: number) => `Page ${page}/${total} • Commands in alphabetical order`,
    usage: 'Usage',
    contactTitle: '📬 Help and contact',
    contact: (supportUrl: string, email: string) =>
      `Questions and problems with the bot: [support server](${supportUrl}). To report abuse or request data deletion: **${email}**`,
    buttons: { panel: 'Dashboard', support: 'Support server', terms: 'Terms', privacy: 'Privacy Policy', status: 'Status' },
    error: 'Something went wrong while showing the help.',
    descriptions: {
      avatar: "Shows a user's avatar in full resolution.",
      birthday: "Shows your saved birthday or another user's.",
      'birthday-remember': 'Saves your birthday (format: DD-MM-YYYY or DD-MM).',
      'birthdays-next': 'Shows the 10 upcoming birthdays in the server.',
      cat: 'Sends a random cat picture. 🐱',
      dog: 'Sends a random dog picture. 🐶',
      emoji: 'Shows all emojis available in the server.',
      faceit: "Shows a player's CS2 stats from FACEIT.",
      level: "Shows your level (XP) or another user's.",
      meme: 'Sends a random meme from Polish sites (kwejk, demotywatory, mistrzowie, ivall).',
      ping: "Checks the bot's latency (ping).",
      roll: 'Roll a die - picks a number from 1 to N (default: 1-6).',
      serverinfo: 'Shows detailed information about the server.',
      toplvl: 'Shows the users ranked by level (top 10 per page).',
      warnings: "Shows your warnings or another user's.",
      minecraft: 'Minecraft server panel: status, players, server start and whitelist.',
    },
  },
});
