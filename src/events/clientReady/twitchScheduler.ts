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
import { fetch } from 'undici';

const THUMBNAIL_WIDTH = '1280';
const THUMBNAIL_HEIGHT = '720';
const THUMBNAILS_DIR = path.resolve(__dirname, '../../../assets/thumbnails');
const MAX_THUMBNAILS = 100;

const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env();

const authProvider = new AppTokenAuthProvider(
  TWITCH_CLIENT_ID as string,
  TWITCH_CLIENT_SECRET as string
);
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
  for (const dir of [path.resolve(__dirname, '../../../assets'), THUMBNAILS_DIR]) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

async function downloadThumbnail(
  url: string,
  streamerName: string,
  streamId: string
): Promise<string | null> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: ctrl.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());

    const filename = `${streamerName}_${streamId}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const filepath = path.join(THUMBNAILS_DIR, filename);

    await fs.writeFile(filepath, buf);

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
  } finally {
    clearTimeout(timeout);
  }
}

async function cleanupOldThumbnails(): Promise<void> {
  try {
    const files = await fs.readdir(THUMBNAILS_DIR);

    if (files.length <= MAX_THUMBNAILS) return;

    const fileStats = await Promise.all(
      files.map(async (file) => ({
        name: file,
        time: (await fs.stat(path.join(THUMBNAILS_DIR, file))).mtime.getTime(),
      }))
    );

    const sortedFiles = fileStats.sort((a, b) => b.time - a.time).slice(MAX_THUMBNAILS);

    await Promise.all(sortedFiles.map((file) => fs.unlink(path.join(THUMBNAILS_DIR, file.name))));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas czyszczenia miniatur: ${message}`);
  }
}

function createStreamNotificationEmbed(
  stream: HelixStream,
  user: HelixUser,
  twitchChannel: string
): EmbedBuilder {
  return createBaseEmbed({
    color: COLORS.TWITCH,
    title: stream.title,
    description: `**Streamuje:** ${stream.gameName || 'Nieznana gra'}`,
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
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn(`Nie znaleziono serwera o ID: ${guildId}`);
    return false;
  }

  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) {
    logger.warn(`Nie znaleziono kanału o ID: ${channelId} lub nie jest to kanał tekstowy`);
    return false;
  }

  const thumbnailUrl = `${stream.thumbnailUrl
    .replace('{width}', THUMBNAIL_WIDTH)
    .replace('{height}', THUMBNAIL_HEIGHT)}?_t=${Date.now()}`;

  const localThumbnailPath = await downloadThumbnail(thumbnailUrl, twitchChannel, stream.id);

  const embed = createStreamNotificationEmbed(stream, user, twitchChannel);

  try {
    if (localThumbnailPath) {
      embed.setImage('attachment://thumbnail.jpg');
      await channel.send({
        embeds: [embed],
        files: [{ attachment: localThumbnailPath, name: 'thumbnail.jpg' }],
      });
    } else {
      embed.setImage(thumbnailUrl);
      await channel.send({ embeds: [embed] });
    }
    return true;
  } catch (sendError: unknown) {
    const msg = sendError instanceof Error ? sendError.message : String(sendError);
    logger.warn(`Błąd wysyłania powiadomienia z miniaturą: ${msg}`);
    await channel.send({ embeds: [embed] });
    return false;
  }
}

async function checkStreams(client: Client): Promise<void> {
  const streamers = await TwitchStreamerModel.find<TwitchStreamerDocument>({ active: true }).exec();
  const channelCfg = await StreamConfigurationModel.find<StreamConfigurationDocument>()
    .lean()
    .exec();

  for (const s of streamers) {

    try {
      const user = await twitchClient.users.getUserByName(s.twitchChannel);
      const stream = user ? await twitchClient.streams.getStreamByUserId(user.id) : null;

      if (stream && !s.isLive) {
        const cfg = channelCfg.find((c) => c.guildId === s.guildId);
        if (
          cfg &&
          (await sendStreamNotification(
            client,
            s.guildId,
            cfg.channelId,
            stream,
            user!,
            s.twitchChannel
          ))
        ) {
          s.isLive = true;
          await s.save();
        }
      }

      if (!stream && s.isLive) {
        s.isLive = false;
        await s.save();
      }
    } catch (err) {
      logger.error(`Streamer ${s.twitchChannel}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
