const { ChannelType } = require("discord.js");
const logger = require("./logger");

/**
 * Usuwa wiadomości wysłane przez danego użytkownika w ciągu ostatniej godziny
 * (lub innego okresu określonego przez parametr timeWindowMs) we wszystkich kanałach tekstowych serwera.
 *
 * @param {Guild} guild - Obiekt serwera Discord.
 * @param {string} userId - ID użytkownika, którego wiadomości mają być usunięte.
 * @param {number} timeWindowMs - Okres (w ms) z tyłu od teraz, z którego wiadomości mają zostać usunięte (domyślnie 3600000 ms czyli 1 godzina).
 */
async function removeRecentMessages(guild, userId, timeWindowMs = 3600000) {
  const cutoff = Date.now() - timeWindowMs;
  const textChannels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildText
  );

  for (const channel of textChannels.values()) {
    try {
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 100 });
        if (!fetched.size) break;
        const messagesToDelete = fetched.filter(
          (msg) => msg.author.id === userId && msg.createdTimestamp >= cutoff
        );
        for (const msg of messagesToDelete.values()) {
          try {
            await msg.delete();
          } catch (err) {
            logger.warn(
              `Nie udało się usunąć wiadomości ${msg.id} z kanału ${channel.id}: ${err.message}`
            );
          }
        }
      } while (fetched.size === 100);
    } catch (err) {
      logger.warn(
        `Błąd przy pobieraniu wiadomości z kanału ${channel.id}: ${err.message}`
      );
    }
  }
}

module.exports = { removeRecentMessages };
