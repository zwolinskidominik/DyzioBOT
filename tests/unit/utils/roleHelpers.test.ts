import { canModerate, checkRole } from '../../../src/utils/roleHelpers';
import type { GuildMember } from 'discord.js';

function makeMember(id: string, position: number, ownerId = 'owner'): GuildMember {
  return {
    id,
    guild: { ownerId } as any,
    roles: { highest: { position } } as any,
  } as unknown as GuildMember;
}

describe('roleHelpers.canModerate & checkRole', () => {
  test('missing params', () => {
    const res = canModerate(null, makeMember('r', 10), makeMember('b', 20));
    expect(res.reason).toBe('MISSING_PARAM');
  });
  test('hierarchy failure cases', () => {
    expect(canModerate(makeMember('owner', 50, 'owner'), makeMember('r', 60, 'owner'), makeMember('b', 100,'owner')).reason).toBe('TARGET_IS_OWNER');
    expect(canModerate(makeMember('x', 10), makeMember('x', 20), makeMember('b', 30)).reason).toBe('SELF_ACTION');
    expect(canModerate(makeMember('t', 50), makeMember('r', 50), makeMember('b', 100)).reason).toBe('TARGET_NOT_LOWER_THAN_REQUESTER');
    expect(canModerate(makeMember('t', 70), makeMember('r', 90), makeMember('b', 70)).reason).toBe('TARGET_NOT_LOWER_THAN_BOT');
  });
  test('allowed', () => {
    expect(checkRole(makeMember('t', 10), makeMember('r', 20), makeMember('b', 30))).toBe(true);
  });

  test('bot lower than requester but higher than target -> allowed', () => {
    // requester pos 50, bot pos 40, target pos 30 => target < bot and target < requester
    expect(checkRole(makeMember('t', 30), makeMember('r', 50), makeMember('b', 40))).toBe(true);
  });
});
