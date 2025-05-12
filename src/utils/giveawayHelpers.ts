import { Guild, User } from 'discord.js';
import logger from '../utils/logger';

export async function pickWinners(
  participants: string[],
  winnersCount: number,
  guild: Guild
): Promise<User[]> {
  if (!participants || participants.length === 0) return [];
  const available = [...participants];
  const winners: User[] = [];

  while (winners.length < winnersCount && available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    const winnerId = available.splice(randomIndex, 1)[0];
    try {
      const member = await guild.members.fetch(winnerId);
      winners.push(member.user);
    } catch (err: unknown) {
      logger.warn(`Nie udało się pobrać użytkownika ${winnerId}: ${err}`);
    }
  }
  return winners;
}
