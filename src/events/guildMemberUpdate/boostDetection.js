const path = require("path");
const fs = require("fs").promises;
const boostChannelId = "1292423972859940966";
const boosterListChannelId = "1196291091280973895";
const emoji = "<:pink_heart:1215648879597453345>";
const boosterRoleId = "1040694065924149300";
const boosterListBanner = path.join(
  __dirname,
  "../../assets/boosterBanner.png"
);

module.exports = async (oldMember, newMember) => {
  const oldStatus = oldMember.premiumSince;
  const newStatus = newMember.premiumSince;

  const updateBoosterList = async (guild) => {
    const boosters = guild.members.cache
      .filter((member) => member.premiumSince)
      .map((member) => `${emoji} <@!${member.user.id}>`)
      .join("\n");
    const channel = guild.channels.cache.get(boosterListChannelId);
    if (!channel) {
      console.error("Nie znaleziono kanału do aktualizacji listy boosterów!");
      return;
    }
    const messageContent = `${boosters}`;
    try {
      await fs.access(boosterListBanner);
      const messages = await channel.messages.fetch({ limit: 5 });
      const listMessage = messages.find(
        (msg) =>
          msg.author.id === guild.client.user.id &&
          msg.content.includes(`${emoji}`)
      );
      if (listMessage) {
        try {
          await listMessage.edit({
            content: messageContent,
            files: [
              { attachment: boosterListBanner, name: "boosterBanner.png" },
            ],
          });
        } catch (editError) {
          console.error(`Nie można edytować wiadomości: ${editError}`);
          await channel.send({
            content: messageContent,
            files: [
              { attachment: boosterListBanner, name: "boosterBanner.png" },
            ],
          });
        }
      } else {
        await channel.send({
          content: messageContent,
          files: [{ attachment: boosterListBanner, name: "boosterBanner.png" }],
        });
      }
    } catch (error) {
      console.error(`Nie znaleziono pliku z bannerem: ${error}`);
      const messages = await channel.messages.fetch({ limit: 5 });
      const listMessage = messages.find(
        (msg) =>
          msg.author.id === guild.client.user.id &&
          msg.content.includes(`${emoji}`)
      );
      if (listMessage) {
        try {
          await listMessage.edit({
            content: messageContent,
          });
        } catch (editError) {
          console.error(`Nie można edytować wiadomości: ${editError}`);
          await channel.send({
            content: messageContent,
          });
        }
      } else {
        await channel.send({
          content: messageContent,
        });
      }
    }
  };

  if (!oldStatus && newStatus) {
    const boostChannel = newMember.guild.channels.cache.get(boostChannelId);
    if (boostChannel) {
      boostChannel.send(
        `Dzięki za wsparcie! <@!${newMember.user.id}>, właśnie dołączyłeś/aś do grona naszych boosterów!`
      );
    }
    await updateBoosterList(newMember.guild);
    const boosterRole = newMember.guild.roles.cache.get(boosterRoleId);
    if (boosterRole) {
      try {
        await newMember.roles.add(boosterRole);
        console.log(
          `Rola boostera została przypisana użytkownikowi ${newMember.user.tag}`
        );
      } catch (error) {
        console.error(`Błąd podczas przypisywania roli boostera: ${error}`);
      }
    } else {
      console.error("Nie znaleziono roli boostera!");
    }
  }

  if (oldStatus && !newStatus) {
    await updateBoosterList(newMember.guild);
    const boosterRole = newMember.guild.roles.cache.get(boosterRoleId);
    if (boosterRole) {
      try {
        await newMember.roles.remove(boosterRole);
        console.log(
          `Rola boostera została usunięta użytkownikowi ${newMember.user.tag}`
        );
      } catch (error) {
        console.error(`Błąd podczas usuwania roli boostera: ${error}`);
      }
    }
  }
};
