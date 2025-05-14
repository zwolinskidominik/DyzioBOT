import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import {
  StreamConfigurationDocument,
  StreamConfigurationModel,
} from '../../models/StreamConfiguration';
import { TwitchStreamerDocument, TwitchStreamerModel } from '../../models/TwitchStreamer';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';
import { env } from '../../config';
import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient, HelixStream, HelixUser } from '@twurple/api';
import { schedule } from 'node-cron';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';

const THUMBNAIL_WIDTH = '1280';
const THUMBNAIL_HEIGHT = '720';
const THUMBNAILS_DIR = path.resolve(__dirname, '../../../assets/thumbnails');
const MAX_THUMBNAILS = 100;

const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();

const clientId: string = TWITCH_CLIENT_ID as string;
const clientSecret: string = TWITCH_CLIENT_SECRET as string;
const authProvider = new AppTokenAuthProvider(clientId, clientSecret);
const twitchClient = new ApiClient({ authProvider });

export default async function run(client: Client): Promise<void> {
  await ensureThumbnailsDirectory().catch((error) =>
    logger.error(`Błąd podczas tworzenia katalogu miniatur: ${error}`)
  );

  schedule(
    '0 0 * * *',
    () => {
      cleanupOldThumbnails().catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`Błąd przy czyszczeniu miniatur: ${msg}`);
      });
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );

  schedule(
    '* * * * *',
    async () => {
      await checkStreams(client);
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}

async function ensureThumbnailsDirectory(): Promise<void> {
  const assetsDir = path.resolve(__dirname, '../../../assets');
  try {
    await fs.access(assetsDir);
  } catch {
    await fs.mkdir(assetsDir, { recursive: true });
  }
  try {
    await fs.access(THUMBNAILS_DIR);
  } catch {
    await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
  }
}

async function downloadThumbnail(
  url: string,
  streamerName: string,
  streamId: string
): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 10_000,
    });

    const filename = `${streamerName}_${streamId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const filepath = path.join(THUMBNAILS_DIR, filename);

    await fs.writeFile(filepath, response.data);

    return filepath;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Błąd pobierania miniatury:', {
      message,
      streamer: streamerName,
      streamId,
      url,
    });
    return null;
  }
}

async function cleanupOldThumbnails(): Promise<void> {
  try {
    const files = await fs.readdir(THUMBNAILS_DIR);

    if (files.length > MAX_THUMBNAILS) {
      const fileStats = await Promise.all(
        files.map(async (file) => ({
          name: file,
          time: (await fs.stat(path.join(THUMBNAILS_DIR, file))).mtime.getTime(),
        }))
      );

      const sortedFiles = fileStats.sort((a, b) => b.time - a.time);

      const filesToDelete = sortedFiles.slice(MAX_THUMBNAILS);

      for (const file of filesToDelete) {
        await fs.unlink(path.join(THUMBNAILS_DIR, file.name));
      }
    } else {
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas czyszczenia miniatur: ${message}`);
  }
}

function createStreamNotificationEmbed(
  client: Client,
  stream: HelixStream,
  user: HelixUser,
  twitchChannel: string
): EmbedBuilder {
  return createBaseEmbed({
    color: COLORS.TWITCH,
    title: stream.title,
    description: `**Streamuje:** ${stream.gameName || 'Nieznana gra'}`,
    footerText: client.user?.username || '',
    footerIcon: client.user?.displayAvatarURL() || '',
    authorName: `${user.displayName} jest teraz live na Twitch! 🔴`,
    authorUrl: `https://www.twitch.tv/${twitchChannel}`,
    authorIcon: user.profilePictureUrl,
    url: `https://www.twitch.tv/${twitchChannel}`,
  });
}

async function sendStreamNotification(
  client: Client,
  guildId: string,
  channelId: string,
  stream: HelixStream,
  user: HelixUser,
  twitchChannel: string
): Promise<boolean> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn(`Nie znaleziono serwera o ID: ${guildId}`);
      return false;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) {
      logger.warn(`Nie znaleziono kanału o ID: ${channelId} lub nie jest to kanał tekstowy`);
      return false;
    }

    const textChannel = channel as TextChannel;

    const rawThumbnailUrl = stream.thumbnailUrl
      .replace('{width}', THUMBNAIL_WIDTH)
      .replace('{height}', THUMBNAIL_HEIGHT);
    const thumbnailUrl = `${rawThumbnailUrl}?_t=${Date.now()}`;

    const localThumbnailPath = await downloadThumbnail(thumbnailUrl, twitchChannel, stream.id);

    const embed = createStreamNotificationEmbed(client, stream, user, twitchChannel);

    try {
      if (localThumbnailPath) {
        embed.setImage('attachment://thumbnail.jpg');
        await textChannel.send({
          embeds: [embed],
          files: [{ attachment: localThumbnailPath, name: 'thumbnail.jpg' }],
        });
      } else {
        embed.setImage(thumbnailUrl);
        await textChannel.send({ embeds: [embed] });
      }
      return true;
    } catch (sendError: unknown) {
      const msg = sendError instanceof Error ? sendError.message : String(sendError);
      logger.warn(`Błąd wysyłania powiadomienia z miniaturą: ${msg}, próba bez miniatury`);
      embed.setImage(null);
      await textChannel.send({ embeds: [embed] });
    }
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd wysyłania powiadomienia o streamie: ${message}`);
    return false;
  }
}

async function checkStreams(client: Client): Promise<void> {
  try {
    const streamers = (await TwitchStreamerModel.find().exec()) as TwitchStreamerDocument[];
    const channels = await StreamConfigurationModel.find<StreamConfigurationDocument>()
      .lean()
      .exec();

    for (const streamer of streamers) {
      const { guildId, twitchChannel, isLive, active } = streamer;

      if (!active) {
        continue;
      }

      try {
        const user = await twitchClient.users.getUserByName(twitchChannel);
        if (!user) {
          logger.warn(`Nie znaleziono użytkownika Twitch: ${twitchChannel}`);
          continue;
        }

        const stream = await twitchClient.streams.getStreamByUserId(user.id);

        if (stream && !isLive) {
          const notificationChannelConfig = channels.find(
            (ch: { guildId: string; channelId: string }) => ch.guildId === guildId
          );

          if (!notificationChannelConfig) {
            logger.debug(`Brak konfiguracji kanału powiadomień dla serwera: ${guildId}`);
            continue;
          }

          const success = await sendStreamNotification(
            client,
            guildId,
            notificationChannelConfig.channelId,
            stream,
            user,
            twitchChannel
          );

          if (success) {
            streamer.isLive = true;
            await streamer.save();
          }
        } else if (!stream && isLive) {
          streamer.isLive = false;
          await streamer.save();
        }
      } catch (streamerError: unknown) {
        const msg = streamerError instanceof Error ? streamerError.message : String(streamerError);
        logger.error(`Błąd podczas sprawdzania streamera ${twitchChannel}: ${msg}`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas sprawdzania streamów: ${message}`);
  }
}
