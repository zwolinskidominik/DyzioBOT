/**
 * Unit tests for backupMonitorService — ocena stanu kopii zapasowych MongoDB na podstawie
 * plików statusu zapisywanych przez ops/mongo/backup.sh i pull-backup.ps1.
 */
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import {
  BackupStatus,
  describeBackupProblems,
  evaluateBackupHealth,
  readBackupStatus,
} from '../../../src/services/backupMonitorService';

const NOW = new Date('2026-10-07T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function status(overrides: Partial<BackupStatus> = {}): BackupStatus {
  return { lastSuccessAt: hoursAgo(8), lastErrorAt: null, lastError: null, lastPullAt: hoursAgo(2), ...overrides };
}

describe('evaluateBackupHealth', () => {
  it('reports nothing when last night backup and the PC pull are fresh', () => {
    expect(evaluateBackupHealth(status(), NOW)).toEqual([]);
  });

  it('flags a failed backup newer than the last success', () => {
    const s = status({ lastErrorAt: hoursAgo(1), lastError: 'mongodump failed' });
    expect(evaluateBackupHealth(s, NOW)).toEqual(['BACKUP_FAILED']);
  });

  it('ignores an old error that a later backup already fixed', () => {
    const s = status({ lastErrorAt: hoursAgo(30), lastSuccessAt: hoursAgo(8) });
    expect(evaluateBackupHealth(s, NOW)).toEqual([]);
  });

  it('flags a missing nightly backup after 26 hours (cron not running)', () => {
    expect(evaluateBackupHealth(status({ lastSuccessAt: hoursAgo(27) }), NOW)).toEqual(['BACKUP_STALE']);
    expect(evaluateBackupHealth(status({ lastSuccessAt: hoursAgo(25) }), NOW)).toEqual([]);
  });

  it('flags when no backup was ever made', () => {
    expect(evaluateBackupHealth(status({ lastSuccessAt: null }), NOW)).toEqual(['NO_BACKUP']);
  });

  it('tolerates the PC being off for a few days, then flags the missing pull', () => {
    expect(evaluateBackupHealth(status({ lastPullAt: hoursAgo(70) }), NOW)).toEqual([]);
    expect(evaluateBackupHealth(status({ lastPullAt: hoursAgo(73) }), NOW)).toEqual(['PULL_STALE']);
    expect(evaluateBackupHealth(status({ lastPullAt: null }), NOW)).toEqual(['PULL_STALE']);
  });
});

describe('readBackupStatus', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-status-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reads the status files written by the backup scripts', async () => {
    await fs.writeFile(path.join(dir, 'backup-ok'), '2026-10-07T03:30:05+00:00\n');
    await fs.writeFile(path.join(dir, 'backup-error'), '2026-10-06T03:30:02+00:00\nKopia przerwana w linii 36: mongodump\n');
    await fs.writeFile(path.join(dir, 'last-pull'), '2026-10-07T10:00:12+02:00\n');

    const result = await readBackupStatus(dir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.lastSuccessAt?.toISOString()).toBe('2026-10-07T03:30:05.000Z');
    expect(result.data.lastErrorAt?.toISOString()).toBe('2026-10-06T03:30:02.000Z');
    expect(result.data.lastError).toBe('Kopia przerwana w linii 36: mongodump');
    expect(result.data.lastPullAt?.toISOString()).toBe('2026-10-07T08:00:12.000Z');
  });

  it('treats missing files as "never happened" instead of failing', async () => {
    const result = await readBackupStatus(dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ lastSuccessAt: null, lastErrorAt: null, lastError: null, lastPullAt: null });
  });
});

describe('describeBackupProblems', () => {
  it('includes the backup error and where to look', () => {
    const text = describeBackupProblems(['BACKUP_FAILED'], status({ lastErrorAt: hoursAgo(1), lastError: 'boom' }));
    expect(text).toContain('Nocna kopia na VPS się nie udała');
    expect(text).toContain('boom');
    expect(text).toContain('backup.log');
  });

  it('points to the PC log when pulls stopped', () => {
    expect(describeBackupProblems(['PULL_STALE'], status())).toContain('pull-backup.log');
  });
});
