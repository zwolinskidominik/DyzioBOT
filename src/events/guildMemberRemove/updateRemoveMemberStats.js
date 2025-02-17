const debounce = require("../../utils/debounce");
const { updateChannelStats } = require("../../utils/updateChannelStats");
const logger = require("../../utils/logger");

/**
 * Event handler dla guildMemberRemove.
 * Przy opuszczeniu serwera, aktualizuje statystyki (liczba użytkowników, botów, banów oraz ostatnia osoba)
 * z użyciem mechanizmu debounce, aby ograniczyć liczbę wywołań API.
 *
 * @param {GuildMember} member - Członek, który opuścił serwer.
 */
module.exports = async (member) => {
  const guild = member.guild;
  if (!guild) return;

  // Używamy debouncingu – dla danego guildId funkcja updateChannelStats zostanie wykonana
  // tylko raz po ustalonym opóźnieniu (np. 2000 ms) od ostatniego zdarzenia.
  debounce(guild.id, async () => {
    try {
      await updateChannelStats(guild);
    } catch (error) {
      logger.error(
        `Błąd w debounced updateChannelStats przy opuszczeniu serwera: ${error}`
      );
    }
  });
};
