const globalCooldowns = new Map();
const COOLDOWN_TIME = 2500;

/**
 * Sprawdza, czy użytkownik jest na cooldownie.
 * Jeśli tak, zwraca liczbę sekund, które pozostały do końca cooldownu.
 * Jeśli nie, ustawia cooldown dla użytkownika i zwraca 0.
 *
 * @param {string} userId - ID użytkownika
 * @returns {number} - Liczba sekund pozostałych do końca cooldownu (0, jeśli cooldown wygasł)
 */
function checkGlobalCooldown(userId) {
  const now = Date.now();
  if (globalCooldowns.has(userId)) {
    const expirationTime = globalCooldowns.get(userId);
    if (now < expirationTime) {
      return (expirationTime - now) / 1000;
    }
  }
  globalCooldowns.set(userId, now + COOLDOWN_TIME);
  return 0;
}

module.exports = { checkGlobalCooldown };
