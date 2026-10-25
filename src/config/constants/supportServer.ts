/**
 * Serwer wsparcia Deezy. Licznik serwerów bota to funkcja tylko dla tego serwera (na innych
 * liczba serwerów całego bota nie ma sensu), więc kanał jest stały, a nie konfigurowany w panelu.
 */
export const SUPPORT_GUILD_ID = '1563365696153329766';

/** Kanał głosowy w kategorii STATS, którego nazwa pokazuje, na ilu serwerach jest bot. */
export const BOT_SERVER_COUNT_CHANNEL = {
  channelId: '1564029992726429696',
  template: '🌐 Servers: {count}',
} as const;
