import { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../interfaces/Command';

const userCooldownUntil = new Map<string, number>();
let checks = 0;

export default async function globalCooldown(
  interaction: ChatInputCommandInteraction,
  command: ICommand
): Promise<string | null> {
  const userId = interaction.user.id;
  const now = Date.now();
  const cooldownSeconds = command.options?.cooldown ?? 2.0;
  const cooldownMs = cooldownSeconds * 1000;

  const until = userCooldownUntil.get(userId) || 0;
  if (until > now) {
    const remainingSeconds = Math.ceil((until - now) / 1000);
    return `Odczekaj jeszcze ${remainingSeconds} sekund przed ponownym użyciem tej komendy.`;
  }

  userCooldownUntil.set(userId, now + cooldownMs);

  if (++checks % 200 === 0 || userCooldownUntil.size > 10_000) {
    for (const [id, ts] of userCooldownUntil) if (ts <= now) userCooldownUntil.delete(id);
    if (checks > 1_000_000) checks = 0;
  }

  return null;
}

export function clearCooldowns(): void {
  userCooldownUntil.clear();
}
