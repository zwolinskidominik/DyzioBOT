const Birthday = require("../../models/Birthday");
const TwitchStreamer = require("../../models/TwitchStreamer");

module.exports = async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    const userId = member.user.id;
    const guildId = guild.id;

    // Deaktywacja wpisu Birthday, jeśli istnieje i jest aktywny
    const birthdayEntry = await Birthday.findOne({ guildId, userId });
    if (birthdayEntry && birthdayEntry.active) {
      await Birthday.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: false } }
      );
      console.log(
        `Deaktywowano wpis urodzin dla użytkownika ${userId} na serwerze ${guildId}.`
      );
    }

    // Deaktywacja wpisu Twitch, jeśli istnieje i jest aktywny
    const twitchEntry = await TwitchStreamer.findOne({ guildId, userId });
    if (twitchEntry && twitchEntry.active) {
      await TwitchStreamer.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: false } }
      );
      console.log(
        `Deaktywowano wpis Twitch dla użytkownika ${userId} na serwerze ${guildId}.`
      );
    }
  } catch (error) {
    console.log(
      "Wystąpił błąd podczas dezaktywacji wpisów użytkownika:",
      error
    );
  }
};
