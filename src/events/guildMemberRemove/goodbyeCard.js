const { AttachmentBuilder } = require("discord.js");
const { Font } = require("canvacord");
const { GreetingsCard } = require("../../utils/GreetingsCard");
const GreetingsConfiguration = require("../../models/GreetingsConfiguration");
const logger = require("../../utils/logger");
const { createBaseEmbed } = require("../../utils/embedUtils");

module.exports = async (member) => {
  try {
    const guild = member.guild;
    if (!guild) return;

    const config = await GreetingsConfiguration.findOne({ guildId: guild.id });
    if (!config || !config.greetingsChannelId) return;

    const channel = guild.channels.cache.get(config.greetingsChannelId);
    if (!channel) return;

    await Font.loadDefault();

    const avatar = member.user.displayAvatarURL({
      extension: "png",
      forceStatic: true,
    });

    const card = new GreetingsCard()
      .setAvatar(avatar)
      .setDisplayName(member.user.tag)
      .setType("goodbye")
      .setMessage(`Miło, że wpadłeś/aś. 👌`);

    const image = await card.build({ format: "png" });
    const attachment = new AttachmentBuilder(image, { name: "welcome.png" });

    const embed = createBaseEmbed({
      description: `### Żegnaj <@!${member.user.id}>! <:bye:1341059186607390770>`,
      image: "attachment://welcome.png",
      color: "#FF0000",
      timestamp: false,
    });

    await channel.send({ embeds: [embed], files: [attachment] });
  } catch (error) {
    logger.error(
      `Błąd w goodbyeCard.js przy userId=${member?.user?.id}: ${error}`
    );
  }
};
