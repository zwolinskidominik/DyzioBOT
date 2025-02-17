// Globalny obiekt przechowujący timeouty dla poszczególnych serwerów (guildId)
const debounceMap = new Map();

/**
 * Debounce – funkcja, która dla danego guildId opóźnia wykonanie podanej funkcji.
 * Jeśli funkcja zostanie wywołana ponownie przed upływem opóźnienia, poprzedni timeout jest czyszczony.
 *
 * @param {string} guildId - ID serwera.
 * @param {Function} func - Funkcja do wykonania.
 * @param {number} delay - Opóźnienie w milisekundach (domyślnie 2000 ms).
 */
function debounce(guildId, func, delay = 2000) {
  if (debounceMap.has(guildId)) {
    clearTimeout(debounceMap.get(guildId));
  }
  const timeout = setTimeout(() => {
    func();
    debounceMap.delete(guildId);
  }, delay);
  debounceMap.set(guildId, timeout);
}

module.exports = debounce;
