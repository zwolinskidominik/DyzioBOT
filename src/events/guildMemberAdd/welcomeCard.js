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
      .setType("welcome")
      .setMessage(`Jesteś ${guild.memberCount} osóbką na serwerze!`);

    const image = await card.build({ format: "png" });
    const attachment = new AttachmentBuilder(image, { name: "welcome.png" });

    const embed = createBaseEmbed({
      description: `### Siema <@!${member.user.id}>! <:hi:1341059174888509521> ###\nWitaj na serwerze ${guild.name}! 🕹️`,
      image: "attachment://welcome.png",
      color: "#86c232",
      timestamp: false,
    });

    await channel.send({ embeds: [embed], files: [attachment] });
  } catch (error) {
    logger.error(
      `Błąd w welcomeCard.js przy userId=${member?.user?.id}: ${error}`
    );
  }
};
