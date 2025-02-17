const cron = require("node-cron");
const Streamer = require("../../models/TwitchStreamer");
const StreamConfiguration = require("../../models/StreamConfiguration");
const { ApiClient } = require("twitch");
const { ClientCredentialsAuthProvider } = require("twitch-auth");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const logger = require("../../utils/logger");
const { createBaseEmbed } = require("../../utils/embedUtils");

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const THUMBNAILS_DIR = path.join(process.cwd(), "assets/thumbnails");

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
const twitchClient = new ApiClient({ authProvider });

async function ensureThumbnailsDirectory() {
  try {
    await fs.access(THUMBNAILS_DIR);
  } catch {
    await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
  }
}

async function downloadThumbnail(url, streamerName, streamId) {
  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const filename = `${streamerName}_${streamId}_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}.jpg`;
    const filepath = path.join(THUMBNAILS_DIR, filename);

    await fs.writeFile(filepath, response.data);
    return filepath;
  } catch (error) {
    logger.error("Błąd pobierania miniatury:", {
      message: error.message,
      streamer: streamerName,
      streamId: streamId,
    });
    return null;
  }
}

async function cleanupOldThumbnails() {
  try {
    const files = await fs.readdir(THUMBNAILS_DIR);

    if (files.length > 100) {
      const fileStats = await Promise.all(
        files.map(async (file) => ({
          name: file,
          time: (
            await fs.stat(path.join(THUMBNAILS_DIR, file))
          ).mtime.getTime(),
        }))
      );

      const sortedFiles = fileStats.sort((a, b) => b.time - a.time).slice(100);

      for (const file of sortedFiles) {
        await fs.unlink(path.join(THUMBNAILS_DIR, file.name));
      }
    }
  } catch (error) {
    logger.error(`Błąd podczas czyszczenia miniatur: ${error}`);
  }
}

module.exports = (client) => {
  ensureThumbnailsDirectory().catch((error) =>
    logger.error(`Błąd podczas tworzenia katalogu miniatur: ${error}`)
  );

  cron.schedule("0 0 * * *", () => {
    cleanupOldThumbnails().catch((error) =>
      logger.error(`Błąd przy cleanupOldThumbnails: ${error}`)
    );
  });

  cron.schedule("* * * * *", async () => {
    try {
      const streamers = await Streamer.find();
      const channels = await StreamConfiguration.find();

      for (const streamer of streamers) {
        const { guildId, twitchChannel, isLive } = streamer;

        const user = await twitchClient.helix.users.getUserByName(
          twitchChannel
        );
        if (!user) {
          logger.warn(`Nie znaleziono użytkownika Twitch: ${twitchChannel}`);
          continue;
        }

        const stream = await twitchClient.helix.streams.getStreamByUserId(
          user.id
        );

        if (stream && !isLive) {
          const notificationChannel = channels.find(
            (ch) => ch.guildId === guildId
          );
          if (notificationChannel) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
              continue;
            }

            const channel = guild.channels.cache.get(
              notificationChannel.channelId
            );
            if (!channel) {
              continue;
            }

            const thumbnailUrl = stream.thumbnailUrl
              .replace("{width}", "1280")
              .replace("{height}", "720");
            const thumbnailUrlWithCache = `${thumbnailUrl}?_t=${Date.now()}`;

            const localThumbnailPath = await downloadThumbnail(
              thumbnailUrlWithCache,
              twitchChannel,
              stream.id
            );

            const embed = createBaseEmbed({
              color: "#9146FF",
              title: stream.title,
              description: `**Streamuje:** ${stream.gameName}`,
              footerText: client.user.username,
              footerIcon: client.user.displayAvatarURL(),
              authorName: `${user.displayName} jest teraz live na Twitch! 🔴`,
              authorUrl: `https://www.twitch.tv/${twitchChannel}`,
              authorIcon: user.profilePictureUrl,
              url: `https://www.twitch.tv/${twitchChannel}`,
            });

            try {
              if (localThumbnailPath) {
                embed.setImage("attachment://thumbnail.jpg");
                await channel.send({
                  embeds: [embed],
                  files: [
                    {
                      attachment: localThumbnailPath,
                      name: "thumbnail.jpg",
                    },
                  ],
                });
              } else {
                embed.setImage(thumbnailUrl);
                await channel.send({ embeds: [embed] });
              }
            } catch (sendError) {
              embed.setImage(null);
              await channel
                .send({ embeds: [embed] })
                .catch((err) =>
                  logger.error(`Nadal błąd przy wysyłaniu embeda: ${err}`)
                );
            }

            streamer.isLive = true;
            await streamer.save();
          }
        } else if (!stream && isLive) {
          streamer.isLive = false;
          await streamer.save();
        }
      }
    } catch (error) {
      logger.error(`Błąd podczas sprawdzania streamów: ${error}`);
    }
  });
};
