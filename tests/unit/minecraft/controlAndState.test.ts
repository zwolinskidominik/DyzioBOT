jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ControlClient, type ControlResult } from '../../../src/services/minecraft/controlClient';
import { channelNameFor, deriveServerView, isMachineUp, UNRESPONSIVE_AFTER_MS } from '../../../src/services/minecraft/serverState';
import { MinecraftMonitor } from '../../../src/services/minecraft/monitor';
import { parseMinecraftConfig } from '../../../src/config/minecraft';
import type { PingResponse } from '../../../src/services/minecraft/serverListPing';

const CONFIG = { controlUrl: 'https://control.example', controlToken: 'x'.repeat(32) };
const OK_BODY = { status: 'RUNNING', ip: '34.1.2.3', lastStart: '2026-11-18T10:00:00Z', started: false };

function response(status: number, body: unknown) {
  return Promise.resolve({ status, json: () => Promise.resolve(body) });
}

describe('ControlClient', () => {
  it('sends the bearer token and validates the answer', async () => {
    const fetchImpl = jest.fn().mockReturnValue(response(200, OK_BODY));
    const client = new ControlClient(CONFIG, { fetchImpl });
    const result = await client.status();
    expect(result).toEqual({ ok: true, data: { status: 'RUNNING', ip: '34.1.2.3', lastStart: new Date('2026-11-18T10:00:00Z'), started: false } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example/status',
      expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: `Bearer ${CONFIG.controlToken}` }) })
    );
  });

  it.each([
    [401, 'config'],
    [404, 'config'],
    [502, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const client = new ControlClient(CONFIG, { fetchImpl: () => response(status, { error: 'gcp_error' }) });
    await expect(client.status()).resolves.toEqual({ ok: false, kind });
  });

  it('rejects an unexpected body and a network error/timeout', async () => {
    await expect(new ControlClient(CONFIG, { fetchImpl: () => response(200, { status: 'BROKEN' }) }).status()).resolves.toEqual({ ok: false, kind: 'unavailable' });
    await expect(new ControlClient(CONFIG, { fetchImpl: () => Promise.reject(new Error('TimeoutError')) }).status()).resolves.toEqual({ ok: false, kind: 'unavailable' });
  });

  it('asks the service at most once per 10 s, but start always goes through', async () => {
    let now = 1_000;
    const fetchImpl = jest.fn().mockImplementation(() => response(200, OK_BODY));
    const client = new ControlClient(CONFIG, { fetchImpl, now: () => now });
    await client.status();
    await client.status();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await client.start();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    now += 10_001;
    await client.status();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('deriveServerView / channel names', () => {
  const NOW = Date.parse('2026-11-18T10:10:00Z');
  const machine = (status: string, extra: Partial<{ lastStart: Date | null; started: boolean }> = {}): ControlResult => ({
    ok: true,
    data: { status: status as 'RUNNING', ip: '1.2.3.4', lastStart: extra.lastStart ?? null, started: extra.started ?? false },
  });
  const ping: PingResponse = { versionName: '1.20.1', online: 3, max: 20, players: ['Kuba'], motd: 'GameZone Pack v5' };

  it('online when our server answers the ping', () => {
    const view = deriveServerView({ ping, machine: undefined, now: NOW });
    expect(view).toEqual({ kind: 'online', online: 3, max: 20, players: ['Kuba'] });
    expect(channelNameFor(view)).toBe('🟢┃ᴏɴʟɪɴᴇ: 3/20');
  });

  it.each([
    ['PROVISIONING', 'starting'],
    ['STAGING', 'starting'],
    ['REPAIRING', 'starting'],
    ['STOPPING', 'stopping'],
    ['TERMINATED', 'offline'],
    ['STOPPED', 'offline'],
    ['SUSPENDED', 'offline'],
  ])('%s → %s', (status, kind) => {
    expect(deriveServerView({ ping: null, machine: machine(status), now: NOW }).kind).toBe(kind);
  });

  it('RUNNING without ping: starting, then unresponsive after 5 min from lastStart', () => {
    const fresh = deriveServerView({ ping: null, machine: machine('RUNNING', { lastStart: new Date(NOW - 60_000) }), now: NOW });
    expect(fresh).toEqual({ kind: 'starting', phase: 'minecraft' });
    const stuck = deriveServerView({ ping: null, machine: machine('RUNNING', { lastStart: new Date(NOW - UNRESPONSIVE_AFTER_MS - 1) }), now: NOW });
    expect(stuck).toEqual({ kind: 'unresponsive' });
    expect(channelNameFor(stuck)).toBe('⚠️┃ɴɪᴇ ᴏᴅᴘᴏᴡɪᴀᴅᴀ');
  });

  it('TERMINATED right after POST /start (started=true) is still "starting"', () => {
    expect(deriveServerView({ ping: null, machine: machine('TERMINATED', { started: true }), now: NOW })).toEqual({ kind: 'starting', phase: 'machine' });
  });

  it('unknown state when the service fails - counter is left as it is', () => {
    const view = deriveServerView({ ping: null, machine: { ok: false, kind: 'unavailable' }, now: NOW });
    expect(view).toEqual({ kind: 'unknown' });
    expect(channelNameFor(view)).toBeNull();
  });

  it('channel names for the remaining states and the start button rule', () => {
    expect(channelNameFor({ kind: 'starting', phase: 'machine' })).toBe('🟡┃ꜱᴛᴀʀᴛᴜᴊᴇ...');
    expect(channelNameFor({ kind: 'offline' })).toBe('🔴┃ᴏꜰꜰʟɪɴᴇ');
    expect(channelNameFor({ kind: 'stopping' })).toBe('🔴┃ᴏꜰꜰʟɪɴᴇ');
    expect(isMachineUp({ kind: 'offline' })).toBe(false);
    expect(isMachineUp({ kind: 'unknown' })).toBe(false);
    expect(isMachineUp({ kind: 'starting', phase: 'minecraft' })).toBe(true);
  });
});

describe('MinecraftMonitor', () => {
  const cfg = { gamePort: 25_565, expectedMotd: 'GameZone Pack v5', expectedVersion: '1.20.1' };
  const ours: PingResponse = { versionName: '1.20.1', online: 1, max: 20, players: [], motd: 'GameZone Pack v5' };

  function control(result: ControlResult) {
    return { status: jest.fn().mockResolvedValue(result), start: jest.fn().mockResolvedValue(result) };
  }

  it('asks the service for the IP, then pings it; later pings the known IP without waking the service', async () => {
    const ctl = control({ ok: true, data: { status: 'RUNNING', ip: '34.1.1.1', lastStart: null, started: false } });
    const ping = jest.fn().mockResolvedValue(ours);
    const monitor = new MinecraftMonitor(cfg, ctl, ping);

    expect((await monitor.refresh()).view.kind).toBe('online');
    expect(ping).toHaveBeenCalledWith('34.1.1.1', 25_565);
    expect(ctl.status).toHaveBeenCalledTimes(1);

    await monitor.refresh();
    expect(ctl.status).toHaveBeenCalledTimes(1);
  });

  it('treats another server on the old IP as no answer and asks the service again', async () => {
    const ctl = control({ ok: true, data: { status: 'TERMINATED', ip: null, lastStart: null, started: false } });
    const ping = jest.fn().mockResolvedValue({ ...ours, motd: 'Some other server' });
    const monitor = new MinecraftMonitor(cfg, ctl, ping);
    monitor.rememberMachine({ ok: true, data: { status: 'RUNNING', ip: '34.9.9.9', lastStart: null, started: false } });

    const snapshot = await monitor.refresh();
    expect(snapshot.view.kind).toBe('offline');
    expect(snapshot.ip).toBeNull();
    expect(ctl.status).toHaveBeenCalledTimes(1);
  });
});

describe('parseMinecraftConfig', () => {
  const base = {
    MC_GUILD_ID: '123456789012345678',
    MC_STARTER_ROLE_ID: '223456789012345678',
    MC_HOST: 'mc.deezy.cc',
    MC_CONTROL_URL: 'https://gamezone-control.example.run.app/',
    MC_CONTROL_TOKEN: 'secret-token-0123456789',
    MC_RCON_PASSWORD: 'rcon-secret',
  };

  it('parses a valid config with defaults and ignores empty optional values', () => {
    const result = parseMinecraftConfig({ ...base, MC_EXPECTED_MOTD: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      gamePort: 25_565,
      rconPort: 25_575,
      controlUrl: 'https://gamezone-control.example.run.app',
      expectedMotd: 'GameZone Pack v5',
      expectedVersion: '1.20.1',
    });
  });

  it('disables the feature on a missing variable or a non-https URL, without leaking secrets', () => {
    const missing = parseMinecraftConfig({ ...base, MC_RCON_PASSWORD: undefined });
    expect(missing.ok).toBe(false);
    const insecure = parseMinecraftConfig({ ...base, MC_CONTROL_URL: 'http://example.com' });
    expect(insecure.ok).toBe(false);
    if (!insecure.ok) expect(insecure.problems.join(' ')).not.toContain(base.MC_CONTROL_TOKEN);
  });
});
