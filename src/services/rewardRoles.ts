import { GuildMember } from 'discord.js';

export async function syncRewardRoles(
  m: GuildMember,
  lvl: number,
  rewards: { level: number; roleId: string }[]
) {
  const best = rewards.filter((r) => r.level <= lvl).sort((a, b) => b.level - a.level)[0] ?? null;

  let gained: string | null = null;

  if (best && !m.roles.cache.has(best.roleId)) {
    await m.roles.add(best.roleId).catch(() => null);
    gained = best.roleId;
  }

  const toRemove = rewards
    .filter((r) => !best || r.roleId !== best.roleId)
    .map((r) => r.roleId)
    .filter((rid) => m.roles.cache.has(rid));

  for (const rid of toRemove) await m.roles.remove(rid).catch(() => null);

  return { gained };
}
