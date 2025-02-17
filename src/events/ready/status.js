const { ActivityType } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = (client) => {
  logger.info(`${client.user.tag} jest online.`);
  client.user.setPresence({
    activities: [{ name: "/help", type: ActivityType.Playing }],
    status: "online",
  });
};
