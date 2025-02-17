const ChannelStats = require("../models/ChannelStats");
const logger = require("../utils/logger");

/**
 * Próbuje zaktualizować nazwę kanału. W przypadku rate limitu (HTTP 429 lub kod 50013)
 * ponawia próbę aktualizacji z exponential backoff.
 *
 * @param {Channel} channel - Obiekt kanału Discord.
 * @param {string} newName - Nowa nazwa kanału.
 * @param {number} retries - Liczba prób.
 * @param {number} delay - Początkowe opóźnienie w milisekundach.
 */
async function safeSetChannelName(channel, newName, retries = 3, delay = 1000) {
  try {
    await channel.setName(newName);
  } catch (error) {
    // Jeśli błąd wynika z rate limitu lub braku uprawnień, spróbuj ponownie
    if ((error.httpStatus === 429 || error.code === 50013) && retries > 0) {
      logger.warn(
        `Rate limited przy aktualizacji nazwy kanału. Ponawianie próby za ${delay} ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return safeSetChannelName(channel, newName, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
}

/**
 * Aktualizuje nazwę kanału na podstawie szablonu.
 * @param {Guild} guild - Obiekt serwera.
 * @param {object} channelConfig - Konfiguracja kanału, np. { channelId, template }.
 * @param {string|number} newValue - Wartość, która zastąpi placeholder <> w szablonie.
 */
async function updateChannelName(guild, channelConfig, newValue) {
  if (!channelConfig || !channelConfig.channelId) return;
  const channel = guild.channels.cache.get(channelConfig.channelId);
  if (!channel) return;
  const newName = channelConfig.template.replace(/<>/g, newValue);
  if (channel.name !== newName) {
    await safeSetChannelName(channel, newName);
  }
}

/**
 * Aktualizuje statystyki kanałów serwera:
 * - Liczba użytkowników (non-botów)
 * - Liczba botów
 * - Liczba banów
 * - Ostatnia osoba (newest)
 *
 * Dane aktualizowane są w dokumencie ChannelStats zapisanym w bazie.
 *
 * @param {Guild} guild - Obiekt serwera.
 */
async function updateChannelStats(guild) {
  const channelStats = await ChannelStats.findOne({ guildId: guild.id });
  if (!channelStats) return;

  try {
    const nonBotMembers = guild.members.cache.filter((m) => !m.user.bot);
    const botMembers = guild.members.cache.filter((m) => m.user.bot);
    const userCount = nonBotMembers.size;
    const botCount = botMembers.size;

    const newestMember = nonBotMembers
      .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
      .first();
    const newestValue = newestMember ? newestMember.user.username : "Brak";

    let banCount = 0;
    try {
      const bans = await guild.bans.fetch();
      banCount = bans.size;
    } catch (error) {
      logger.error(`Błąd przy pobieraniu banów: ${error}`);
    }

    const updatePromises = [];
    if (channelStats.channels.users) {
      updatePromises.push(
        updateChannelName(guild, channelStats.channels.users, userCount)
      );
    }
    if (channelStats.channels.bots) {
      updatePromises.push(
        updateChannelName(guild, channelStats.channels.bots, botCount)
      );
    }
    if (channelStats.channels.bans) {
      updatePromises.push(
        updateChannelName(guild, channelStats.channels.bans, banCount)
      );
    }
    if (channelStats.channels.lastJoined) {
      updatePromises.push(
        updateChannelName(
          guild,
          channelStats.channels.lastJoined,
          newestValue
        ).then(() => {
          channelStats.channels.lastJoined.member = newestMember
            ? newestMember.id
            : null;
        })
      );
    }

    await Promise.all(updatePromises);
    await channelStats.save();
  } catch (error) {
    logger.error(`Błąd przy aktualizacji statystyk: ${error}`);
  }
}

module.exports = {
  updateChannelStats,
};
