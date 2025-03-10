const path = require("path");
const fs = require("fs").promises;
const boostChannelId = "1292423972859940966";
const boosterListChannelId = "1196291091280973895";
const oldEmoji = "<:pink_heart:1215648879597453345>";
const listEmoji = "<a:nitro:1341055584941899776>";
const thanksEmoji = "<:thx:1341058534632067152>";
const boosterRoleId = "1040694065924149300";
const boosterListBanner = path.join(
  __dirname,
  "../../../assets/boosterBanner.png"
);
const logger = require("../../utils/logger");

module.exports = async (oldMember, newMember) => {
  const oldStatus = oldMember.premiumSince;
  const newStatus = newMember.premiumSince;

  const updateBoosterList = async (guild) => {
    const boosters = guild.members.cache
      .filter((member) => member.premiumSince)
      .map((member) => `${listEmoji} <@!${member.user.id}>`)
      .join("\n");

    const channel = guild.channels.cache.get(boosterListChannelId);

    if (!channel) {
      logger.error("Nie znaleziono kanału do aktualizacji listy boosterów!");
      return;
    }

    try {
      await fs.access(boosterListBanner);

      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessages = messages.filter(
        (msg) => msg.author.id === guild.client.user.id
      );

      for (const msg of botMessages.values()) {
        if (
          msg.attachments.size > 0 ||
          msg.content.includes(listEmoji) ||
          msg.content.includes(oldEmoji)
        ) {
          try {
            await msg.delete();
          } catch (deleteError) {
            logger.warn(`Nie można usunąć starej wiadomości: ${deleteError}`);
          }
        }
      }

      const bannerMessage = {
        files: [{ attachment: boosterListBanner, name: "boosterBanner.png" }],
      };
      await channel.send(bannerMessage);

      const boosterListMessage = { content: boosters };
      await channel.send(boosterListMessage);
    } catch (error) {
      logger.error(`Wystąpił błąd przy boosterList: ${error}`);
      await channel.send({ content: boosters });
    }
  };

  if (!oldStatus && newStatus) {
    const boostChannel = newMember.guild.channels.cache.get(boostChannelId);
    if (boostChannel) {
      boostChannel.send(
        `Dzięki za wsparcie! <@!${newMember.user.id}>, właśnie dołączyłeś/aś do grona naszych boosterów! ${thanksEmoji}`
      );
    }
    await updateBoosterList(newMember.guild);
  }

  if (oldStatus && !newStatus) {
    await updateBoosterList(newMember.guild);
  }
};
