const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const { fetchMeme, SITES } = require("../../utils/memes");
const logger = require("../../utils/logger");

const cooldowns = new Map();

function formatMemeResponse(meme) {
  const embed = createBaseEmbed({
    color: "#2b2d31",
    title: meme.title || "Random meme",
    footerText: `Źródło: ${meme.source}`,
  });

  if (!meme.isVideo) {
    embed.setImage(meme.url);
  }

  if (meme.isVideo) {
    return {
      files: [
        {
          attachment: meme.url,
          name: "video.mp4",
        },
      ],
      embeds: [embed],
    };
  }

  return { embeds: [embed] };
}

async function getAlternativeMeme() {
  const availableSites = Object.keys(SITES);

  for (const site of availableSites) {
    try {
      const meme = await fetchMeme(site);
      if (meme) return meme;
    } catch (error) {
      logger.warn(`Nie udało się pobrać mema z ${site}: ${error.message}`);
      continue;
    }
  }
  return null;
}

function checkCooldown(userId) {
  const cooldownTime = 5000;
  const now = Date.now();
  const userCooldown = cooldowns.get(userId);

  if (userCooldown && now < userCooldown) {
    const timeLeft = (userCooldown - now) / 1000;
    return Math.ceil(timeLeft);
  }

  cooldowns.set(userId, now + cooldownTime);
  return 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Losuje mema z losowej strony z listy dostępnych stron"),

  run: async ({ interaction }) => {
    const timeLeft = checkCooldown(interaction.user.id);
    if (timeLeft > 0) {
      return await interaction.reply({
        content: `Odczekaj jeszcze ${timeLeft} sekundy przed użyciem komendy ponownie.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const availableSites = Object.keys(SITES);
      const randomSite =
        availableSites[Math.floor(Math.random() * availableSites.length)];

      const meme = await fetchMeme(randomSite);

      if (!meme) {
        logger.warn(`Brak mema ze strony: ${randomSite}`);
        return await interaction.editReply({
          content:
            "Przepraszamy, nie udało się pobrać mema. Spróbuj ponownie później.",
        });
      }

      return await interaction.editReply(formatMemeResponse(meme));
    } catch (error) {
      logger.error(`Błąd podczas wykonywania komendy /meme: ${error.message}`);
      logger.error(error.stack);

      try {
        const alternativeMeme = await getAlternativeMeme();
        if (alternativeMeme) {
          return await interaction.editReply(
            formatMemeResponse(alternativeMeme)
          );
        }
      } catch (retryError) {
        logger.error(
          `Błąd podczas próby pobrania mema z alternatywnej strony: ${retryError.message}`
        );
      }

      return await interaction.editReply({
        content:
          "Przepraszamy, nie udało się pobrać mema. Spróbuj ponownie później.",
      });
    }
  },
};
