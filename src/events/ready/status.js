const { ActivityType } = require("discord.js");

module.exports = (client) => {
  console.log(`${client.user.tag} jest online.`);
  client.user.setPresence({
    activities: [{ name: "/help", type: ActivityType.Playing }],
    status: "online",
  });
};
