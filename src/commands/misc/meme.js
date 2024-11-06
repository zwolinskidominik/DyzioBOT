const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchMeme, SITES } = require("../../utils/memes");

const cooldowns = new Map();

function formatMemeResponse(meme) {
  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(meme.title || "Random meme")
    .setTimestamp()
    .setFooter({ text: `Źródło: ${meme.source}` });

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
      console.error(`Nie udało się pobrać mema z ${site}: ${error.message}`);
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
        content: `Poczekaj jeszcze ${timeLeft} sekund przed użyciem tej komendy ponownie.`,
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
        return await interaction.editReply({
          content:
            "Przepraszamy, nie udało się pobrać mema. Spróbuj ponownie później.",
        });
      }

      return await interaction.editReply(formatMemeResponse(meme));
    } catch (error) {
      console.error(`Błąd podczas wykonywania komendy meme: ${error.message}`);
      console.error(error.stack);

      try {
        const alternativeMeme = await getAlternativeMeme();
        if (alternativeMeme) {
          return await interaction.editReply(
            formatMemeResponse(alternativeMeme)
          );
        }
      } catch (retryError) {
        console.error(
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
