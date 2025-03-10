const cron = require("node-cron");
const Giveaway = require("../../models/Giveaway");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");
const pickWinners = require("../../utils/pickWinners");

/**
 * @param {Client} client
 */
module.exports = (client) => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const giveawaysToEnd = await Giveaway.find({
        active: true,
        endTime: { $lte: now },
      });
  
      if (giveawaysToEnd.length > 0) {
        logger.info(`Scheduler: znaleziono ${giveawaysToEnd.length} giveawayów do zakończenia.`);
      }
  
      for (const giveaway of giveawaysToEnd) {
        if (!giveaway.hostId) {
          logger.warn(`Giveaway ${giveaway.giveawayId} nie posiada hostId. Usuwam z bazy.`);
          await Giveaway.deleteOne({ giveawayId: giveaway.giveawayId });
          continue;
        }
  
        giveaway.active = false;
        await giveaway.save();
  
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) {
          logger.warn(`Nie znaleziono serwera o ID ${giveaway.guildId} dla giveaway ${giveaway.giveawayId}`);
          await Giveaway.deleteOne({ giveawayId: giveaway.giveawayId });
          continue;
        }
  
        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
          logger.warn(`Nie znaleziono kanału o ID ${giveaway.channelId} dla giveaway ${giveaway.giveawayId}`);
          await Giveaway.deleteOne({ giveawayId: giveaway.giveawayId });
          continue;
        }
  
        let giveawayMessage;
        try {
          giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (err) {
          logger.warn(`Nie udało się pobrać wiadomości giveaway ${giveaway.giveawayId}: ${err.message}`);
          await Giveaway.deleteOne({ giveawayId: giveaway.giveawayId });
          continue;
        }
        if (!giveawayMessage) {
          await Giveaway.deleteOne({ giveawayId: giveaway.giveawayId });
          continue;
        }
  
        const winners = await pickWinners(giveaway.participants, giveaway.winnersCount, guild);
        const winnersText = winners.length ? winners.map((user) => `<@${user.id}>`).join(", ") : "";
        const participantsCount = giveaway.participants.length;
        const timestamp = Math.floor(giveaway.endTime.getTime() / 1000);
  
        const updatedEmbed = createBaseEmbed({
          description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
          footerText: `Giveaway ID: ${giveaway.giveawayId}`,
          color: "#2B2D31",
        });
  
        try {
          await giveawayMessage.edit({
            content: "### 🎉 🎉 Giveaway 🎉 🎉",
            embeds: [updatedEmbed],
            components: [],
          });
          logger.info(`Giveaway ${giveaway.giveawayId} został automatycznie zakończony.`);
        } catch (err) {
          logger.error(`Błąd przy edycji wiadomości giveaway ${giveaway.giveawayId}: ${err.message}`);
        }
  
        if (winners.length > 0) {
          await giveawayMessage.reply({
            content: `Gratulacje ${winners.map((user) => `<@${user.id}>`).join(", ")}! **${giveaway.prize}** jest Twoje!`
          });
        } else {
          await giveawayMessage.reply({
            content: "Brak zgłoszeń, więc nie udało się wyłonić zwycięzcy!"
          });
        }
      }
    } catch (error) {
      logger.error(`Błąd w schedulerze giveawayów: ${error}`);
    }
  });  
};
