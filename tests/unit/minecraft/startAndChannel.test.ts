jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { RenameLimiter, RENAME_MIN_INTERVAL_MS } from '../../../src/services/minecraft/statsChannel';
import {
  StartController,
  START_COOLDOWN_MS,
  START_TIMEOUT_MS,
  progressText,
} from '../../../src/services/minecraft/startController';
import type { MonitorSnapshot } from '../../../src/services/minecraft/monitor';
import type { ControlResult } from '../../../src/services/minecraft/controlClient';
import type { ServerView } from '../../../src/services/minecraft/serverState';
import { canManageWhitelist, canStartServer, memberRoleIds } from '../../../src/services/minecraft/permissions';
import { MC_IDS, buildPanelButtons, buildPanelEmbed, parseMcCustomId } from '../../../src/utils/minecraftEmbeds';
import { planWhitelistSteps, NickSchema } from '../../../src/services/minecraft/whitelistService';

describe('RenameLimiter', () => {
  it('renames only on a difference and at most once per 5 min, keeping only the newest name', () => {
    let now = 0;
    const limiter = new RenameLimiter(RENAME_MIN_INTERVAL_MS, () => now);

    limiter.request('🔴┃ᴏꜰꜰʟɪɴᴇ');
    expect(limiter.takeDue('🔴┃ᴏꜰꜰʟɪɴᴇ')).toBeNull(); // brak różnicy

    limiter.request('🟡┃ꜱᴛᴀʀᴛᴜᴊᴇ...');
    expect(limiter.takeDue('🔴┃ᴏꜰꜰʟɪɴᴇ')).toBe('🟡┃ꜱᴛᴀʀᴛᴜᴊᴇ...');

    now += 60_000;
    limiter.request('🟢┃ᴏɴʟɪɴᴇ: 1/20');
    limiter.request('🟢┃ᴏɴʟɪɴᴇ: 2/20');
    expect(limiter.takeDue('🟡┃ꜱᴛᴀʀᴛᴜᴊᴇ...')).toBeNull(); // limit 5 min

    now += RENAME_MIN_INTERVAL_MS;
    expect(limiter.takeDue('🟡┃ꜱᴛᴀʀᴛᴜᴊᴇ...')).toBe('🟢┃ᴏɴʟɪɴᴇ: 2/20'); // tylko najnowszy stan
  });

  it('ignores "unknown" (null) requests', () => {
    const limiter = new RenameLimiter(RENAME_MIN_INTERVAL_MS, () => 0);
    limiter.request(null);
    expect(limiter.takeDue('🔴┃ᴏꜰꜰʟɪɴᴇ')).toBeNull();
  });
});

describe('StartController', () => {
  const started: ControlResult = { ok: true, data: { status: 'TERMINATED', ip: null, lastStart: null, started: true } };
  const snap = (view: ServerView): MonitorSnapshot => ({ view, ip: '1.2.3.4', checkedAt: 0 });

  function setup(views: ServerView[], startResult: ControlResult = started) {
    let now = 0;
    const queue = [...views];
    const monitor = {
      control: { start: jest.fn().mockResolvedValue(startResult), status: jest.fn() },
      refresh: jest.fn().mockImplementation(() => Promise.resolve(snap(queue.length > 1 ? queue.shift()! : queue[0]!))),
      rememberMachine: jest.fn(),
    };
    const controller = new StartController(monitor, {
      now: () => now,
      sleep: (ms) => {
        now += ms;
        return Promise.resolve();
      },
    });
    return { controller, monitor, advance: (ms: number) => (now += ms) };
  }

  it('reports each stage until the server is ready, then applies the 5 min cooldown', async () => {
    const { controller, advance } = setup([{ kind: 'offline' }, { kind: 'starting', phase: 'minecraft' }, { kind: 'online', online: 0, max: 20, players: [] }]);
    const stages: string[] = [];
    const outcome = await controller.start(async (s) => {
      stages.push(progressText(s.view));
    });
    expect(outcome.kind).toBe('ready');
    // „offline” zaraz po zleceniu startu pokazujemy jako „maszyna startuje”.
    expect(stages).toEqual(['⏳ Maszyna startuje…', '⏳ Minecraft się ładuje…', '✅ Serwer gotowy - wchodźcie!']);

    const again = await controller.start(async () => undefined);
    expect(again.kind).toBe('cooldown');
    advance(START_COOLDOWN_MS);
    expect(controller.cooldownRemaining()).toBe(0);
  });

  it('gives up after 5 min', async () => {
    const { controller } = setup([{ kind: 'starting', phase: 'minecraft' }]);
    const outcome = await controller.start(async () => undefined);
    expect(outcome.kind).toBe('timeout');
    expect(START_TIMEOUT_MS).toBe(5 * 60_000);
  });

  it('does not start the cooldown when the service fails', async () => {
    const { controller, monitor } = setup([{ kind: 'offline' }], { ok: false, kind: 'unavailable' });
    expect((await controller.start(async () => undefined)).kind).toBe('unavailable');
    expect(controller.cooldownRemaining()).toBe(0);
    expect(monitor.refresh).not.toHaveBeenCalled();
  });
});

describe('permissions', () => {
  const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);
  const none = new PermissionsBitField();

  it('whitelist: guild owner and Administrator only', () => {
    expect(canManageWhitelist({ userId: 'owner', guildOwnerId: 'owner', permissions: none, roleIds: [] })).toBe(true);
    expect(canManageWhitelist({ userId: 'u', guildOwnerId: 'owner', permissions: admin, roleIds: [] })).toBe(true);
    expect(canManageWhitelist({ userId: 'u', guildOwnerId: 'owner', permissions: none, roleIds: ['starter'] })).toBe(false);
    expect(canManageWhitelist({ userId: 'u', guildOwnerId: null, permissions: null, roleIds: [] })).toBe(false);
  });

  it('start: only the starter role', () => {
    expect(canStartServer({ userId: 'u', guildOwnerId: null, permissions: none, roleIds: ['starter'] }, 'starter')).toBe(true);
    expect(canStartServer({ userId: 'u', guildOwnerId: null, permissions: admin, roleIds: [] }, 'starter')).toBe(false);
  });

  it('reads role IDs from an API member and from a cached GuildMember', () => {
    expect(memberRoleIds({ roles: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(memberRoleIds({ roles: { cache: new Map([['c', {}]]) } })).toEqual(['c']);
    expect(memberRoleIds(null)).toEqual([]);
  });
});

describe('customId', () => {
  it('accepts only known mc: ids', () => {
    expect(parseMcCustomId('mc:start')).toEqual({ kind: MC_IDS.start });
    expect(parseMcCustomId('mc:add-modal:123456789012345678')).toEqual({ kind: MC_IDS.addModalPrefix, userId: '123456789012345678' });
    expect(parseMcCustomId('mc:add-modal:abc')).toBeNull();
    expect(parseMcCustomId('mc:whatever')).toBeNull();
    expect(parseMcCustomId('wrapped:personal')).toBeNull();
  });

  it('disables the start button while the machine is up', () => {
    const startButton = (view: ServerView) => buildPanelButtons(view)[0]!.components[1]!.toJSON();
    expect(startButton({ kind: 'offline' })).toMatchObject({ disabled: false });
    expect(startButton({ kind: 'online', online: 0, max: 20, players: [] })).toMatchObject({ disabled: true });
  });

  it('shows who started the server only while the machine is up', () => {
    const startedBy = { userId: '123456789012345678', at: new Date('2026-11-22T20:00:00Z') };
    const field = (view: ServerView) => buildPanelEmbed(view, 'mc.deezy.cc', { startedBy }).toJSON().fields?.find((f) => f.name === 'Włączył');
    expect(field({ kind: 'online', online: 1, max: 20, players: [] })?.value).toBe(`<@${startedBy.userId}> <t:1795377600:R>`);
    expect(field({ kind: 'starting', phase: 'machine' })).toBeDefined();
    expect(field({ kind: 'offline' })).toBeUndefined();
  });
});

describe('whitelist plan and nick validation', () => {
  it.each(['Kuba', 'Kuba_123', 'abc', 'A234567890123456'])('accepts nick %s', (nick) => {
    expect(NickSchema.safeParse(nick).success).toBe(true);
  });

  it.each(['ab', 'A2345678901234567', 'Kuba 1', 'Kuba;op', 'Żaba'])('rejects nick %s', (nick) => {
    expect(NickSchema.safeParse(nick).success).toBe(false);
  });

  it('removes the old nick before adding the new one', () => {
    expect(planWhitelistSteps({ nick: 'New', status: 'pending', previousNick: 'Old' })).toEqual([
      { action: 'remove', nick: 'Old', effect: 'clear_previous' },
      { action: 'add', nick: 'New', effect: 'mark_added' },
    ]);
  });

  it('does nothing for added entries and for nicks Minecraft does not know (no retry every minute)', () => {
    expect(planWhitelistSteps({ nick: 'Kuba', status: 'added' })).toEqual([]);
    expect(planWhitelistSteps({ nick: 'Kuba', status: 'no_such_player' })).toEqual([]);
  });

  it('removal deletes the entry after removing it from the server', () => {
    expect(planWhitelistSteps({ nick: 'Kuba', status: 'removing' })).toEqual([{ action: 'remove', nick: 'Kuba', effect: 'delete_entry' }]);
  });
});
