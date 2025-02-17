const debounce = require("../../utils/debounce");
const { updateChannelStats } = require("../../utils/updateChannelStats");
const logger = require("../../utils/logger");

/**
 * Event handler dla guildMemberAdd. Gdy użytkownik dołącza do serwera,
 * aktualizacja statystyk (liczba użytkowników, botów, banów, najnowsza osoba)
 * zostanie wykonana z użyciem mechanizmu debounce, aby scalić wiele wywołań.
 *
 * @param {GuildMember} member - Obiekt członka, który dołączył.
 */
module.exports = async (member) => {
  const guild = member.guild;
  if (!guild) return;

  // Używamy debouncingu – dla danego guildId funkcja updateChannelStats zostanie wykonana
  // tylko raz po 2000 ms od ostatniego wywołania.
  debounce(guild.id, async () => {
    try {
      await updateChannelStats(guild);
    } catch (error) {
      logger.error(`Błąd w debounced updateChannelStats: ${error}`);
    }
  });
};
