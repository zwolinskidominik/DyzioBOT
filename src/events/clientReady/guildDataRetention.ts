import { schedule } from 'node-cron';
import { Client } from 'discord.js';
import { CRON } from '../../config/constants/cron';
import { purgeExpiredGuildData, reconcileGuildDepartures } from '../../services/guildDataRetentionService';
import logger from '../../utils/logger';
import { env } from '../../config';

/**
 * Przy starcie i raz dziennie: uzgadnia listę serwerów, z których bota usunięto (także w czasie,
 * gdy był offline), a potem kasuje dane serwerów po upływie okresu retencji.
 */
async function runRetention(client: Client): Promise<void> {
  const presentGuildIds = [...client.guilds.cache.keys()];

  const reconcile = await reconcileGuildDepartures(presentGuildIds);
  if (!reconcile.ok) {
    // Bez wiarygodnej listy serwerów nie wolno niczego kasować.
    logger.warn(`[Retention] ${reconcile.message}`);
    return;
  }
  if (reconcile.data.marked > 0) {
    logger.info(`[Retention] Wykryto ${reconcile.data.marked} serwer(ów), z których usunięto bota.`);
  }

  const purge = await purgeExpiredGuildData(presentGuildIds);
  if (purge.ok && purge.data.purgedGuilds.length > 0) {
    logger.info(
      `[Retention] Usunięto dane ${purge.data.purgedGuilds.length} serwer(ów), ${purge.data.deletedDocuments} dokumentów.`
    );
  }
}

export default async function run(client: Client): Promise<void> {
  // Włączane jawnie (GUILD_DATA_RETENTION=on w .env produkcji). Domyślnie wyłączone, bo instancja
  // developerska podpięta pod tę samą bazę widzi inne serwery niż produkcja — uruchomiona
  // u niej retencja uznałaby serwery produkcyjne za opuszczone.
  if (env().GUILD_DATA_RETENTION !== 'on') {
    logger.info('[Retention] Wyłączone (GUILD_DATA_RETENTION != on) — dane usuniętych serwerów nie są czyszczone.');
    return;
  }

  await runRetention(client).catch((err) => logger.error(`[Retention] Błąd przy starcie: ${err}`));

  schedule(
    CRON.GUILD_DATA_RETENTION,
    () => {
      runRetention(client).catch((err) => logger.error(`[Retention] Błąd w schedulerze: ${err}`));
    },
    { timezone: 'Europe/Warsaw' }
  );
}
