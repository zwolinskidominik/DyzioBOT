const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const Streamer = require("../../models/TwitchStreamer");
const StreamConfiguration = require("../../models/StreamConfiguration");
const { ApiClient } = require("twitch");
const { ClientCredentialsAuthProvider } = require("twitch-auth");

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
const twitchClient = new ApiClient({ authProvider });

module.exports = (client) => {
  cron.schedule("*/5 * * * * *", async () => {
    try {
      const streamers = await Streamer.find();
      const channels = await StreamConfiguration.find();

      for (const streamer of streamers) {
        const { guildId, twitchChannel, isLive } = streamer;

        const user = await twitchClient.helix.users.getUserByName(
          twitchChannel
        );
        if (!user) {
          console.log(`Nie znaleziono użytkownika Twitch: ${twitchChannel}`);
          continue;
        }

        const stream = await twitchClient.helix.streams.getStreamByUserId(
          user.id
        );

        if (stream && !isLive) {
          const notificationChannel = channels.find(
            (channel) => channel.guildId === guildId
          );

          if (notificationChannel) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild.channels.cache.get(
              notificationChannel.channelId
            );

            const embed = new EmbedBuilder()
              .setColor("#9146FF")
              .setAuthor({
                name: `${user.displayName} jest teraz live na Twitch! 🔴`,
                url: `https://www.twitch.tv/${twitchChannel}`,
                iconURL: user.profilePictureUrl,
              })
              .setTitle(stream.title)
              .setURL(`https://www.twitch.tv/${twitchChannel}`)
              .setDescription(`**Streamuje:** ${stream.gameName}`)
              .setImage(
                stream.thumbnailUrl
                  .replace("{width}", "1280")
                  .replace("{height}", "720")
              )
              .setFooter({
                text: client.user.username,
                iconURL: client.user.displayAvatarURL(),
              })
              .setTimestamp();

            await channel.send({ embeds: [embed] });

            streamer.isLive = true;
            await streamer.save();
          }
        } else if (!stream && isLive) {
          streamer.isLive = false;
          await streamer.save();
        }
      }
    } catch (error) {
      console.error(`Error checking Twitch streams: ${error}`);
    }
  });
};
