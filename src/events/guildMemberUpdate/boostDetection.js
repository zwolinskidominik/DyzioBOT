const boostChannelId = "881296019948732457";
const boosterListChannelId = "1196291091280973895";
const boosterListBanner = "../../assets/boosterBanner.png";
const emoji = "<:pink_heart:1215648879597453345>";

module.exports = async (oldMember, newMember) => {
  const oldStatus = oldMember.premiumSince;
  const newStatus = newMember.premiumSince;

  if (!oldStatus && newStatus) {
    client.channels.cache
      .get(boostChannelId)
      .send(
        `Dzięki za wsparcie! <!@${newMember.user.id}>, właśnie dołączyłeś/aś do grona naszych boosterów!`
      );

    await updateBoosterList(newMember.guild);
  }

  if (oldStatus && !newStatus) {
    await updateBoosterList(newMember.guild);
  }
};

async function updateBoosterList(guild) {
  const boosters = guild.members.cache
    .filter((member) => member.premiumSince)
    .map((member) => `${emoji} <@!${member.user.id}>`)
    .join("\n");

  const channel = client.channels.cache.get(boosterListChannelId);
  if (!channel)
    return console.error(
      "Nie znaleziono kanału do aktualizacji listy boosterów!"
    );

  const messageContent = `${boosters}`;

  const messages = await channel.messages.fetch({ limit: 5 });
  const listMessage = messages.find((msg) => msg.content.includes(`${emoji}`));

  if (listMessage) {
    await listMessage.edit({
      content: messageContent,
      files: [{ attachment: boosterListBanner, name: "boosterBanner.png" }],
    });
  } else {
    await channel.send({
      content: messageContent,
      files: [{ attachment: boosterListBanner, name: "boosterBanner.png" }],
    });
  }
}
