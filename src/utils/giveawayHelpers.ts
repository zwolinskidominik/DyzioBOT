import { Guild, User } from 'discord.js';
import logger from '../utils/logger';

export async function pickWinners(
  participants: string[],
  winnersCount: number,
  guild: Guild
): Promise<User[]> {
  if (!participants || participants.length === 0) {
    return [];
  }
  if (!winnersCount || winnersCount < 1) {
    logger.warn(`pickWinners: nieprawidłowa liczba zwycięzców (${winnersCount}), ustawiam 1`);
    winnersCount = 1;
  }

  const tickets = [...participants];
  const maxShuffle = Math.min(tickets.length, winnersCount * 5);
  for (let i = 0; i < maxShuffle; i++) {
    const j = i + Math.floor(Math.random() * (tickets.length - i));
    [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
  }
  const candidateIds = tickets.slice(0, maxShuffle);

  const winners: User[] = [];
  const seen = new Set<string>();
  const missing: string[] = [];

  for (const id of candidateIds) {
    if (seen.has(id)) continue;
    const member = guild.members.cache.get(id);
    if (member) {
      winners.push(member.user);
      seen.add(id);
      if (winners.length === winnersCount) {
        return winners;
      }
    } else if (!missing.includes(id)) {
      missing.push(id);
    }
  }

  if (missing.length) {
    try {
      await guild.members.fetch({ user: missing });
    } catch (err) {
      logger.warn(`pickWinners: błąd bulk fetch (${missing.length}): ${err}`);
    }
  }

  for (const id of missing) {
    if (winners.length === winnersCount) break;
    if (seen.has(id)) continue;
    const m = guild.members.cache.get(id);
    if (m) {
      winners.push(m.user);
      seen.add(id);
    }
  }

  if (winners.length < winnersCount) {
    for (const id of candidateIds) {
      if (winners.length === winnersCount) break;
      if (seen.has(id)) continue;
      try {
        const member = await guild.members.fetch(id);
        winners.push(member.user);
        seen.add(id);
      } catch {}
    }
  }

  if (winners.length === 0) {
    for (const id of candidateIds.slice(0, winnersCount)) {
      try {
        const user = await guild.client.users.fetch(id);
        if (user) {
          winners.push(user);
          break;
        }
      } catch {}
    }
  }

  if (winners.length === 0) {
    logger.warn(
      `pickWinners: brak zwycięzców. Możliwe przyczyny: wszyscy opuścili serwer, brak intentów, problemy z cache.`
    );
  }
  return winners.slice(0, winnersCount);
}
