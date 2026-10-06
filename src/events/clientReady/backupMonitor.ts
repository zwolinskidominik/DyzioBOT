import { Client } from 'discord.js';
import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { COLORS } from '../../config/constants/colors';
import { env } from '../../config';
import {
  BackupProblem,
  describeBackupProblems,
  evaluateBackupHealth,
  readBackupStatus,
} from '../../services/backupMonitorService';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

/**
 * Co godzinę sprawdza kopie zapasowe MongoDB i pisze do właściciela w prywatnej wiadomości,
 * gdy coś przestało działać — oraz raz, gdy wszystko wróci do normy. Ten sam problem nie jest
 * powtarzany co godzinę (tylko zmiana stanu wysyła wiadomość).
 *
 * Włączane przez BACKUP_ALERT_USER_ID w .env produkcji (ID konta, które ma dostawać alerty).
 */

let lastAlertKey = '';

async function sendDm(client: Client, userId: string, embed: ReturnType<typeof createBaseEmbed>): Promise<void> {
  const user = await client.users.fetch(userId);
  await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

export async function checkBackups(client: Client, userId: string, statusDir: string, now = new Date()): Promise<void> {
  const status = await readBackupStatus(statusDir);
  if (!status.ok) {
    logger.warn(`[BackupMonitor] ${status.message}`);
    return;
  }

  const problems: BackupProblem[] = evaluateBackupHealth(status.data, now);
  const key = [...problems].sort().join(',');
  if (key === lastAlertKey) return;

  const hadProblems = lastAlertKey !== '';

  // Stan zapamiętujemy dopiero po wysłaniu wiadomości — gdy DM się nie uda, kolejna
  // godzinna kontrola spróbuje jeszcze raz.
  if (problems.length > 0) {
    logger.warn(`[BackupMonitor] Problem z kopiami: ${key}`);
    await sendDm(
      client,
      userId,
      createBaseEmbed({
        title: '⚠️ Kopie zapasowe bazy',
        description: describeBackupProblems(problems, status.data),
        color: COLORS.WARN,
        timestamp: true,
      })
    );
  } else if (hadProblems) {
    logger.info('[BackupMonitor] Kopie znowu działają.');
    await sendDm(
      client,
      userId,
      createBaseEmbed({
        title: '✅ Kopie zapasowe bazy',
        description: 'Wszystko znowu działa: nocna kopia na VPS i pobieranie na PC są aktualne.',
        color: COLORS.JOIN,
        timestamp: true,
      })
    );
  }
  lastAlertKey = key;
}

/** Tylko do testów — stan alertu żyje w pamięci procesu. */
export function resetBackupMonitorState(): void {
  lastAlertKey = '';
}

export default function run(client: Client): void {
  const { BACKUP_ALERT_USER_ID: userId, BACKUP_STATUS_DIR: statusDir = '/app/backup-status' } = env();
  if (!userId) {
    logger.info('[BackupMonitor] Wyłączony (brak BACKUP_ALERT_USER_ID).');
    return;
  }

  const check = () => {
    checkBackups(client, userId, statusDir).catch((err) => logger.error(`[BackupMonitor] ${err}`));
  };

  check();
  schedule(CRON.BACKUP_MONITOR, check, { timezone: 'Europe/Warsaw' });
}
