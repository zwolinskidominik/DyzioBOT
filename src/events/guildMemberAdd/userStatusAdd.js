const Birthday = require("../../models/Birthday");
const TwitchStreamer = require("../../models/TwitchStreamer");

module.exports = async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    const userId = member.user.id;
    const guildId = guild.id;

    // Ponowna aktywacja wpisu Birthday, jeśli istnieje i jest nieaktywny
    const birthdayEntry = await Birthday.findOne({ guildId, userId });
    if (birthdayEntry && birthdayEntry.active === false) {
      await Birthday.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: true } }
      );
      console.log(
        `Ponownie aktywowano wpis urodzin dla użytkownika ${userId} na serwerze ${guildId}.`
      );
    }

    // Ponowna aktywacja wpisu Twitch, jeśli istnieje i jest nieaktywny
    const twitchEntry = await TwitchStreamer.findOne({ guildId, userId });
    if (twitchEntry && twitchEntry.active === false) {
      await TwitchStreamer.findOneAndUpdate(
        { guildId, userId },
        { $set: { active: true } }
      );
      console.log(
        `Ponownie aktywowano wpis Twitch dla użytkownika ${userId} na serwerze ${guildId}.`
      );
    }
  } catch (error) {
    console.log(
      "Wystąpił błąd podczas ponownej aktywacji wpisów użytkownika:",
      error
    );
  }
};
