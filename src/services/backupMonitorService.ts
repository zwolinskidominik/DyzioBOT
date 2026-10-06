import { promises as fs } from 'fs';
import path from 'path';
import { ServiceResult, ok, fail } from '../types/serviceResult';

/**
 * Pilnuje kopii zapasowych MongoDB i mówi, czy coś jest nie tak.
 *
 * Skrypty kopii zapisują krótkie pliki statusu w katalogu, który bot widzi tylko do odczytu:
 *   backup-ok     — data ostatniej udanej nocnej kopii na VPS (ops/mongo/backup.sh)
 *   backup-error  — data i treść ostatniego błędu nocnej kopii
 *   last-pull     — data ostatniego udanego pobrania kopii na PC właściciela (pull-backup.ps1)
 * Bot nie ma dostępu do samych kopii (zawierają m.in. hashe haseł bazy) — tylko do statusu.
 */

export type BackupProblem = 'NO_BACKUP' | 'BACKUP_FAILED' | 'BACKUP_STALE' | 'PULL_STALE';

export interface BackupStatus {
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  lastPullAt: Date | null;
}

/** Nocna kopia jest o 3:30 — 26 h daje zapas na przesunięcia i restart serwera. */
export const BACKUP_MAX_AGE_MS = 26 * 60 * 60 * 1000;
/** PC może być wyłączony kilka dni (wyjazd) — alarmujemy dopiero po 3 dniach bez pobrania. */
export const PULL_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function readBackupStatus(dir: string): Promise<ServiceResult<BackupStatus>> {
  try {
    const [okRaw, errorRaw, pullRaw] = await Promise.all([
      readOptional(path.join(dir, 'backup-ok')),
      readOptional(path.join(dir, 'backup-error')),
      readOptional(path.join(dir, 'last-pull')),
    ]);

    const [errorDateLine, ...errorMessage] = (errorRaw ?? '').split('\n');
    return ok({
      lastSuccessAt: parseDate(okRaw ?? undefined),
      lastErrorAt: parseDate(errorDateLine),
      lastError: errorMessage.join('\n').trim() || null,
      lastPullAt: parseDate(pullRaw ?? undefined),
    });
  } catch (err) {
    return fail('STATUS_UNREADABLE', `Nie udało się odczytać statusu kopii: ${err}`);
  }
}

export function evaluateBackupHealth(status: BackupStatus, now: Date = new Date()): BackupProblem[] {
  const problems: BackupProblem[] = [];
  const { lastSuccessAt, lastErrorAt, lastPullAt } = status;

  if (lastErrorAt && (!lastSuccessAt || lastErrorAt > lastSuccessAt)) {
    problems.push('BACKUP_FAILED');
  } else if (!lastSuccessAt) {
    problems.push('NO_BACKUP');
  } else if (now.getTime() - lastSuccessAt.getTime() > BACKUP_MAX_AGE_MS) {
    problems.push('BACKUP_STALE');
  }

  if (!lastPullAt || now.getTime() - lastPullAt.getTime() > PULL_MAX_AGE_MS) {
    problems.push('PULL_STALE');
  }

  return problems;
}

function formatDate(date: Date | null): string {
  return date ? `<t:${Math.floor(date.getTime() / 1000)}:R>` : 'nigdy';
}

/** Treść wiadomości do właściciela — konkretnie, co się stało i gdzie zajrzeć. */
export function describeBackupProblems(problems: BackupProblem[], status: BackupStatus): string {
  const lines = problems.map((problem) => {
    switch (problem) {
      case 'BACKUP_FAILED':
        return (
          `**Nocna kopia na VPS się nie udała** (${formatDate(status.lastErrorAt)}).\n` +
          `\`\`\`\n${(status.lastError ?? 'brak szczegółów').slice(0, 800)}\n\`\`\`` +
          'Szczegóły: `/srv/deezy-secure/backups/backup.log`'
        );
      case 'NO_BACKUP':
        return '**Na VPS nie ma jeszcze żadnej kopii.** Uruchom `bash ops/mongo/backup.sh` i sprawdź crontab.';
      case 'BACKUP_STALE':
        return (
          `**Brak nowej kopii na VPS** — ostatnia udana: ${formatDate(status.lastSuccessAt)}.\n` +
          'Sprawdź `crontab -l` i `/srv/deezy-secure/backups/backup.log`.'
        );
      case 'PULL_STALE':
        return (
          `**PC nie pobrał kopii** — ostatnie pobranie: ${formatDate(status.lastPullAt)}.\n` +
          'Jeśli komputer był włączony, sprawdź `C:\\Backupy\\Deezy\\pull-backup.log`.'
        );
    }
  });
  return lines.join('\n\n');
}
