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
    if (birthdayEntry && birthdayEntry.active) {
      await Birthday.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: false } }
      );
    }

    const twitchEntry = await TwitchStreamer.findOne({ guildId, userId });
    if (twitchEntry && twitchEntry.active) {
      await TwitchStreamer.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: false } }
      );
    }
  } catch (error) {
    logger.error(
      `Wystąpił błąd podczas dezaktywacji wpisów userId=${member.user.id}: ${error}`
    );
  }
};
