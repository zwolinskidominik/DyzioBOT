import { defineMessages } from "../config";

/** Auto role (/[guildId]/autoroles). */
export const autorolesMessages = defineMessages({
  pl: {
    title: "Auto Role",
    subtitle: "Automatycznie przypisuj role nowym członkom i botom zaraz po dołączeniu do serwera.",
    toggle: "Włącz lub wyłącz auto role",
    removeHigher: "Usuń role wyższe niż rola bota, zanim zapiszesz.",
    disabledPrefix: "Moduł auto ról jest ",
    disabledStrong: "globalnie wyłączony",
    disabledMiddle: ". Możesz edytować konfigurację, ale bot nie przypisze ról nowym członkom, dopóki nie włączysz przełącznika ",
    disabledSuffix: " u góry i nie zapiszesz konfiguracji.",
    users: {
      title: "Role użytkowników",
      description: "Przypisywane automatycznie każdemu nowemu użytkownikowi",
      empty: "Brak przypisanych ról użytkowników. Dodaj poniżej.",
    },
    bots: {
      title: "Role botów",
      description: "Opcjonalnie: przypisywane tylko nowym botom",
      empty: "Brak przypisanych ról botów. Zostaw puste, jeśli nie chcesz przypisywać roli botom.",
    },
    hierarchyWarning:
      "Nie mogę nadać jednej z wybranych ról, bo jest wyżej niż moja rola na serwerze. Przesuń rolę Deezy wyżej niż zaznaczone role lub usuń je z listy.",
  },
  en: {
    title: "Auto Roles",
    subtitle: "Automatically give roles to new members and bots as soon as they join the server.",
    toggle: "Turn auto roles on or off",
    removeHigher: "Remove roles higher than the bot's role before saving.",
    disabledPrefix: "The auto roles module is ",
    disabledStrong: "turned off",
    disabledMiddle: ". You can edit the settings, but the bot won't give roles to new members until you turn on the ",
    disabledSuffix: " switch at the top and save.",
    users: {
      title: "Member roles",
      description: "Given automatically to every new member",
      empty: "No member roles yet. Add one below.",
    },
    bots: {
      title: "Bot roles",
      description: "Optional: given only to new bots",
      empty: "No bot roles yet. Leave it empty if you don't want to give bots a role.",
    },
    hierarchyWarning:
      "I can't give one of the selected roles because it's above my role on the server. Move the Deezy role above the marked roles or remove them from the list.",
  },
});
