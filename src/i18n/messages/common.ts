import { defineMessages, plural, pluralEn } from '../index';

/** Komunikaty wspólne dla wszystkich komend: dostęp, cooldown, wyłączone moduły, błędy ogólne. */
export const commonMessages = defineMessages({
  pl: {
    guildOnly: 'Ta komenda działa tylko na serwerze.',
    devOnly: '⛔ Ta komenda jest dostępna tylko dla deweloperów.',
    ownerOnly: '⛔ Ta komenda jest dostępna tylko dla właściciela bota.',
    restrictedGuild: '⛔ Ta komenda jest dostępna tylko na wybranych serwerach.',
    userMissingPermissions: '⛔ Potrzebujesz uprawnień do wykonania tej komendy.',
    botMissingPermissions: '⛔ Bot potrzebuje uprawnień do wykonania tej komendy.',
    commandError: 'Wystąpił błąd podczas wykonywania komendy.',
    commandsModuleDisabled: '🔧 Moduł Komendy jest wyłączony na tym serwerze.',
    commandDisabled: '🔧 Ta komenda jest wyłączona na tym serwerze.',
    moduleDisabled: (module: string) => `🔧 Moduł ${module} jest wyłączony na tym serwerze.`,
    cooldown: (seconds: number) =>
      `Odczekaj jeszcze ${seconds} ${plural(seconds, ['sekundę', 'sekundy', 'sekund'])} przed ponownym użyciem tej komendy.`,
    notAvailableInLanguage: '🌐 Ta komenda jest na razie dostępna tylko na serwerach z językiem polskim.',
  },
  en: {
    guildOnly: 'This command only works in a server.',
    devOnly: '⛔ This command is only available to developers.',
    ownerOnly: '⛔ This command is only available to the bot owner.',
    restrictedGuild: '⛔ This command is only available in selected servers.',
    userMissingPermissions: '⛔ You need permissions to use this command.',
    botMissingPermissions: '⛔ The bot needs permissions to run this command.',
    commandError: 'Something went wrong while running this command.',
    commandsModuleDisabled: '🔧 The Commands module is disabled in this server.',
    commandDisabled: '🔧 This command is disabled in this server.',
    moduleDisabled: (module: string) => `🔧 The ${module} module is disabled in this server.`,
    cooldown: (seconds: number) =>
      `Please wait ${seconds} more ${pluralEn(seconds, 'second', 'seconds')} before using this command again.`,
    notAvailableInLanguage: '🌐 This command is currently only available in Polish-language servers.',
  },
});
