/**
 * Unit tests for the backup monitor — DM do właściciela tylko przy zmianie stanu kopii.
 */
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import type { Client } from 'discord.js';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { checkBackups, resetBackupMonitorState } from '../../../src/events/clientReady/backupMonitor';

const USER_ID = '548177225661546496';
const NOW = new Date('2026-10-07T12:00:00Z');

describe('backupMonitor', () => {
  let dir: string;
  const send = jest.fn().mockResolvedValue(undefined);
  const client = { users: { fetch: jest.fn().mockResolvedValue({ send }) } } as unknown as Client;

  const writeStatus = async (backupOk: string | null, lastPull: string | null) => {
    await fs.rm(path.join(dir, 'backup-ok'), { force: true });
    await fs.rm(path.join(dir, 'last-pull'), { force: true });
    if (backupOk) await fs.writeFile(path.join(dir, 'backup-ok'), backupOk);
    if (lastPull) await fs.writeFile(path.join(dir, 'last-pull'), lastPull);
  };
  const sentTitles = () => send.mock.calls.map(([payload]) => payload.embeds[0].data.title);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-monitor-'));
    send.mockClear();
    resetBackupMonitorState();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('stays silent while backups are healthy', async () => {
    await writeStatus('2026-10-07T03:30:00Z', '2026-10-07T10:00:00Z');
    await checkBackups(client, USER_ID, dir, NOW);
    expect(send).not.toHaveBeenCalled();
  });

  it('DMs once when backups break, not every hour, and once more when they recover', async () => {
    await writeStatus('2026-10-05T03:30:00Z', '2026-10-07T10:00:00Z'); // nocna kopia nie powstała
    await checkBackups(client, USER_ID, dir, NOW);
    await checkBackups(client, USER_ID, dir, new Date(NOW.getTime() + 3_600_000));
    expect(sentTitles()).toEqual(['⚠️ Kopie zapasowe bazy']);
    expect(client.users.fetch).toHaveBeenCalledWith(USER_ID);

    await writeStatus('2026-10-07T03:30:00Z', '2026-10-07T10:00:00Z');
    await checkBackups(client, USER_ID, dir, NOW);
    expect(sentTitles()).toEqual(['⚠️ Kopie zapasowe bazy', '✅ Kopie zapasowe bazy']);
  });

  it('retries on the next check when the DM could not be sent', async () => {
    await writeStatus(null, null);
    send.mockRejectedValueOnce(new Error('Cannot send messages to this user'));
    await expect(checkBackups(client, USER_ID, dir, NOW)).rejects.toThrow();
    await checkBackups(client, USER_ID, dir, NOW);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
