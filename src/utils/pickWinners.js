async function pickWinners(participants, winnersCount, guild) {
    if (!participants || participants.length === 0) return [];
    const available = [...participants];
    const winners = [];
    while (winners.length < winnersCount && available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const winnerId = available.splice(randomIndex, 1)[0];
      try {
        const member = await guild.members.fetch(winnerId);
        winners.push(member.user);
      } catch (err) {
        logger.warn(`Nie udało się pobrać użytkownika ${winnerId}: ${err.message}`);
      }
    }
    return winners;
  }

module.exports = pickWinners;