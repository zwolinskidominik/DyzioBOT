import { getXpMultipliers } from '../../../src/utils/xpMultiplier';
import { Collection } from 'discord.js';

/* ── mock factory ─────────────────────────────────────────── */

function mockMember(roleIds: string[]): any {
  const cache = new Collection<string, any>();
  for (const id of roleIds) cache.set(id, { id });
  return { roles: { cache } };
}

/* ── tests ────────────────────────────────────────────────── */

describe('getXpMultipliers', () => {
  it('returns { role: 1, channel: 1 } when config is null', () => {
    expect(getXpMultipliers(mockMember([]), 'ch-1', null)).toEqual({ role: 1, channel: 1 });
  });

  it('returns { role: 1, channel: 1 } when config is undefined', () => {
    expect(getXpMultipliers(mockMember([]), 'ch-1', undefined)).toEqual({ role: 1, channel: 1 });
  });

  it('returns { role: 1, channel: 1 } when no multipliers are defined', () => {
    expect(getXpMultipliers(mockMember([]), 'ch-1', {})).toEqual({ role: 1, channel: 1 });
  });

  it('returns channel multiplier when member is in matching channel', () => {
    const cfg = { channelMultipliers: [{ channelId: 'ch-1', multiplier: 2.5 }] };
    expect(getXpMultipliers(mockMember([]), 'ch-1', cfg)).toEqual({ role: 1, channel: 2.5 });
  });

  it('returns role: 1 when member has no matching roles', () => {
    const cfg = { roleMultipliers: [{ roleId: 'r-99', multiplier: 3 }] };
    expect(getXpMultipliers(mockMember(['r-1']), 'ch-1', cfg)).toEqual({ role: 1, channel: 1 });
  });

  it('returns highest role multiplier when member has multiple matching roles', () => {
    const cfg = {
      roleMultipliers: [
        { roleId: 'r-1', multiplier: 1.5 },
        { roleId: 'r-2', multiplier: 3 },
        { roleId: 'r-3', multiplier: 2 },
      ],
    };
    expect(getXpMultipliers(mockMember(['r-1', 'r-2', 'r-3']), 'ch-1', cfg)).toEqual({
      role: 3,
      channel: 1,
    });
  });

  it('returns channel: 1 when channelId does not match any multiplier', () => {
    const cfg = { channelMultipliers: [{ channelId: 'ch-99', multiplier: 5 }] };
    expect(getXpMultipliers(mockMember([]), 'ch-1', cfg)).toEqual({ role: 1, channel: 1 });
  });

  it('returns both role and channel multipliers simultaneously', () => {
    const cfg = {
      roleMultipliers: [{ roleId: 'r-1', multiplier: 2 }],
      channelMultipliers: [{ channelId: 'ch-1', multiplier: 1.5 }],
    };
    expect(getXpMultipliers(mockMember(['r-1']), 'ch-1', cfg)).toEqual({ role: 2, channel: 1.5 });
  });
});
