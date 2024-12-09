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

  try {
    await fs.access(boosterListBanner);

    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(
      (msg) => msg.author.id === guild.client.user.id
    );

    for (const msg of botMessages.values()) {
      if (msg.attachments.size > 0 || msg.content.includes(emoji)) {
        try {
          await msg.delete();
        } catch (deleteError) {
          console.error(`Nie można usunąć starej wiadomości: ${deleteError}`);
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
    console.error(`Wystąpił błąd: ${error}`);
    await channel.send({ content: boosters });
  }
};
