import { Collection, Invite } from 'discord.js';
import { InviteUsageModel } from '../../../src/models/InviteUsage';
import {
  syncGuildInvites,
  recordInvite,
  recordConsumedInvite,
  markInviteDeleted,
  getInviterTotalUses,
} from '../../../src/services/inviteUsageService';

const G = '881293681783623680';

function invites(entries: Array<{ code: string; uses: number; inviterId?: string }>): Collection<string, Invite> {
  const c = new Collection<string, Invite>();
  for (const e of entries) {
    c.set(e.code, { code: e.code, uses: e.uses, inviter: e.inviterId ? { id: e.inviterId } : null } as unknown as Invite);
  }
  return c;
}

beforeEach(async () => {
  await InviteUsageModel.deleteMany({});
});

describe('inviteUsageService', () => {
  it('keeps the count of an invite after it disappears from Discord (expired/deleted)', async () => {
    await syncGuildInvites(G, invites([
      { code: 'a', uses: 200, inviterId: 'u1' },
      { code: 'b', uses: 186, inviterId: 'u1' },
      { code: 'c', uses: 99, inviterId: 'u2' },
    ]));
    // „b" wygasło - nie ma go już na liście
    await syncGuildInvites(G, invites([
      { code: 'a', uses: 201, inviterId: 'u1' },
      { code: 'c', uses: 99, inviterId: 'u2' },
    ]));

    const total = await getInviterTotalUses(G, 'u1');
    expect(total).toEqual({ ok: true, data: 387 });
    const b = await InviteUsageModel.findOne({ guildId: G, code: 'b' }).lean();
    expect(b?.deleted).toBe(true);
    expect(b?.uses).toBe(186);
  });

  it('never lowers a stored counter', async () => {
    await syncGuildInvites(G, invites([{ code: 'a', uses: 10, inviterId: 'u1' }]));
    await syncGuildInvites(G, invites([{ code: 'a', uses: 3, inviterId: 'u1' }]));
    expect(await getInviterTotalUses(G, 'u1')).toEqual({ ok: true, data: 10 });
  });

  it('records the final count of a consumed invite', async () => {
    await recordInvite(G, invites([{ code: 's', uses: 0, inviterId: 'u1' }]).get('s')!);
    await recordConsumedInvite(G, 's', 'u1', 1);
    expect(await getInviterTotalUses(G, 'u1')).toEqual({ ok: true, data: 1 });
  });

  it('markInviteDeleted keeps the counter in the history', async () => {
    await syncGuildInvites(G, invites([{ code: 'a', uses: 7, inviterId: 'u1' }]));
    await markInviteDeleted(G, 'a');
    expect(await getInviterTotalUses(G, 'u1')).toEqual({ ok: true, data: 7 });
  });

  it('returns null for an inviter the bot knows no invite of, and scopes by guild', async () => {
    await syncGuildInvites('other-guild-000000', invites([{ code: 'x', uses: 50, inviterId: 'u1' }]));
    expect(await getInviterTotalUses(G, 'u1')).toEqual({ ok: true, data: null });
  });

  it('does not overwrite a known inviter with null', async () => {
    await syncGuildInvites(G, invites([{ code: 'a', uses: 1, inviterId: 'u1' }]));
    await syncGuildInvites(G, invites([{ code: 'a', uses: 2 }]));
    const a = await InviteUsageModel.findOne({ guildId: G, code: 'a' }).lean();
    expect(a?.inviterId).toBe('u1');
  });
});
