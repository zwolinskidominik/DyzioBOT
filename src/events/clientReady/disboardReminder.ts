import { Client, TextChannel, ChannelType } from 'discord.js';
import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { DisboardConfigModel, DEFAULT_DISBOARD_MESSAGE } from '../../models/DisboardConfig';
import logger from '../../utils/logger';

/** Min/max days between reminders (inclusive). */
const MIN_INTERVAL_DAYS = 12;
const MAX_INTERVAL_DAYS = 18;

/** Time window for random hour — sends between 10:00 and 20:00. */
const MIN_HOUR = 10;
const MAX_HOUR = 20;

/**
 * Compute the next random send date.
 * Picks a random number of days (12-18) in the future and a random hour (10-20).
 */
export function computeNextSendAt(from: Date = new Date()): Date {
  const days = MIN_INTERVAL_DAYS + Math.floor(Math.random() * (MAX_INTERVAL_DAYS - MIN_INTERVAL_DAYS + 1));
  const hour = MIN_HOUR + Math.floor(Math.random() * (MAX_HOUR - MIN_HOUR + 1));
  const minute = Math.floor(Math.random() * 60);

  const next = new Date(from);
  next.setDate(next.getDate() + days);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.DISBOARD_REMINDER_CHECK,
    async () => {
      try {
        const configs = await DisboardConfigModel.find({ enabled: true }).lean();
        if (!configs.length) return;

        const now = new Date();

        for (const config of configs) {
          try {
            if (!config.channelId) continue;

            /* First-time setup: compute initial nextSendAt */
            if (!config.nextSendAt) {
              const nextSendAt = computeNextSendAt(now);
              await DisboardConfigModel.updateOne(
                { guildId: config.guildId },
                { $set: { nextSendAt } },
              );
              logger.info(
                `[Disboard] Zaplanowano pierwszą przypominajkę dla ${config.guildId} na ${nextSendAt.toISOString()}`,
              );
              continue;
            }

            if (now < new Date(config.nextSendAt)) continue;

            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(config.channelId);
            if (
              !channel ||
              (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildNews)
            ) {
              logger.warn(
                `[Disboard] Kanał ${config.channelId} nie istnieje lub nie jest tekstowy (guild ${config.guildId})`,
              );
              continue;
            }

            await (channel as TextChannel).send(config.message || DEFAULT_DISBOARD_MESSAGE);

            const nextSendAt = computeNextSendAt(now);
            await DisboardConfigModel.updateOne(
              { guildId: config.guildId },
              { $set: { lastSentAt: now, nextSendAt } },
            );

            logger.info(
              `[Disboard] Wysłano przypominajkę na ${config.guildId}. Następna: ${nextSendAt.toISOString()}`,
            );
          } catch (error) {
            logger.error(
              `[Disboard] Błąd wysyłania przypominajki dla ${config.guildId}: ${error}`,
            );
          }
        }
      } catch (error) {
        logger.error(`[Disboard] Błąd w schedulerze: ${error}`);
      }
    },
    { timezone: 'Europe/Warsaw' },
  );
}
