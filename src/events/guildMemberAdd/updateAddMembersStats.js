const debounce = require("../../utils/debounce");
const { updateChannelStats } = require("../../utils/updateChannelStats");
const logger = require("../../utils/logger");

/**
 * @param {GuildMember} member
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
