jest.mock('pretty-ms', () => ({
  __esModule: true,
  default: jest.fn((ms: number) => `${ms}ms`),
}));

import {
  canModerate,
  getModFailMessage,
  formatHumanDuration,
} from '../../../src/utils/moderationHelpers';

/* ── helpers ─────────────────────────────────────────── */
function makeMember(id: string, highestPos: number, guildOwnerId = 'owner'): any {
  return {
    id,
    guild: { ownerId: guildOwnerId },
    roles: { highest: { position: highestPos } },
  };
}

/* ── canModerate ─────────────────────────────────────── */
describe('canModerate', () => {
  it('returns MISSING_PARAM when any param is null', () => {
    expect(canModerate(null, makeMember('r', 5), makeMember('b', 10)).reason).toBe('MISSING_PARAM');
    expect(canModerate(makeMember('t', 3), null, makeMember('b', 10)).reason).toBe('MISSING_PARAM');
    expect(canModerate(makeMember('t', 3), makeMember('r', 5), null).reason).toBe('MISSING_PARAM');
  });

  it('blocks when target is guild owner', () => {
    const target = makeMember('owner', 100, 'owner');
    const req = makeMember('mod', 50);
    const bot = makeMember('bot', 90);
    const r = canModerate(target, req, bot);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TARGET_IS_OWNER');
  });

  it('blocks self-action', () => {
    const member = makeMember('u1', 50);
    const r = canModerate(member, member, makeMember('bot', 90));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('SELF_ACTION');
  });

  it('blocks when target role >= requester role', () => {
    const target = makeMember('t', 60);
    const req = makeMember('r', 50);
    const r = canModerate(target, req, makeMember('bot', 90));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TARGET_NOT_LOWER_THAN_REQUESTER');
  });

  it('blocks when target role >= bot role', () => {
    const target = makeMember('t', 80);
    const req = makeMember('r', 90);
    const bot = makeMember('bot', 70);
    const r = canModerate(target, req, bot);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TARGET_NOT_LOWER_THAN_BOT');
  });

  it('allows when all checks pass', () => {
    const target = makeMember('t', 10);
    const req = makeMember('r', 50);
    const bot = makeMember('bot', 90);
    const r = canModerate(target, req, bot);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeUndefined();
  });
});

/* ── getModFailMessage ───────────────────────────────── */
describe('getModFailMessage', () => {
  it('returns null when moderation is allowed', () => {
    const target = makeMember('t', 10);
    const req = makeMember('r', 50);
    const bot = makeMember('bot', 90);
    expect(getModFailMessage(target, req, bot, 'ban')).toBeNull();
  });

  it('returns Polish failure message for owner target', () => {
    const target = makeMember('owner', 100, 'owner');
    const req = makeMember('r', 50);
    const bot = makeMember('bot', 90);
    const msg = getModFailMessage(target, req, bot, 'ban');
    expect(msg).toContain('zbanować');
    expect(msg).toContain('właściciela');
  });

  it('returns message for self-action (kick)', () => {
    const member = makeMember('u1', 50);
    const msg = getModFailMessage(member, member, makeMember('bot', 90), 'kick');
    expect(msg).toContain('wyrzucić');
    expect(msg).toContain('samego siebie');
  });

  it('returns message when botMember is null', () => {
    const target = makeMember('t', 10);
    const req = makeMember('r', 50);
    const msg = getModFailMessage(target, req, null, 'mute');
    expect(msg).toContain('uprawnień');
  });

  it('returns message for each action type', () => {
    const target = makeMember('owner', 100, 'owner');
    const req = makeMember('r', 50);
    const bot = makeMember('bot', 90);
    for (const action of ['ban', 'kick', 'mute', 'unban', 'warn'] as const) {
      const msg = getModFailMessage(target, req, bot, action);
      expect(msg).toBeTruthy();
    }
  });
});

/* ── formatHumanDuration ─────────────────────────────── */
describe('formatHumanDuration', () => {
  it('calls prettyMs with verbose:false', () => {
    const result = formatHumanDuration(60000);
    // Our mock returns `${ms}ms`
    expect(result).toBe('60000ms');
  });
});
