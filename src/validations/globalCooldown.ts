import { ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../interfaces/Command';

const cooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN = 2_500;

export default async (
  interaction: ChatInputCommandInteraction,
  command: ICommand
): Promise<string | null> => {
  const userId = interaction.user.id;
  const now = Date.now();

  const cooldown =
    command.options && command.options.cooldown ? command.options.cooldown : DEFAULT_COOLDOWN;

  const expiry = cooldowns.get(userId);
  if (expiry && now < expiry) {
    const remainingSeconds = Math.ceil((expiry - now) / 1_000);
    return `Odczekaj jeszcze ${remainingSeconds} sekund przed ponownym użyciem tej komendy.`;
  }

  cooldowns.set(userId, now + cooldown);
  return null;
};
