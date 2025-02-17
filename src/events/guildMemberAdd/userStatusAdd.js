const Birthday = require("../../models/Birthday");
const TwitchStreamer = require("../../models/TwitchStreamer");
const logger = require("../../utils/logger");

module.exports = async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    const userId = member.user.id;
    const guildId = guild.id;

    const birthdayEntry = await Birthday.findOne({ guildId, userId });
    if (birthdayEntry && birthdayEntry.active === false) {
      await Birthday.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: true } }
      );
    }

    const twitchEntry = await TwitchStreamer.findOne({ guildId, userId });
    if (twitchEntry && twitchEntry.active === false) {
      await TwitchStreamer.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: true } }
      );
    }
  } catch (error) {
    logger.error(
      `Wystąpił błąd podczas ponownej aktywacji wpisów userId=${member.user.id}: ${error}`
    );
  }
};
