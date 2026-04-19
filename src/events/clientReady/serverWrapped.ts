import { Client, TextChannel, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import cron from 'node-cron';
import logger from '../../utils/logger';
import { collectWrappedData, renderWrappedCanvas } from '../../services/serverWrappedService';
import { WrappedConfigModel } from '../../models/WrappedConfig';
import { LevelModel } from '../../models/Level';
import { LevelSnapshotModel } from '../../models/LevelSnapshot';

/**
 * Takes a snapshot of every user's level & XP so that Wrapped can show yearly growth.
 */
async function takeLevelSnapshots(guildId: string, year: number): Promise<void> {
  const levels = await LevelModel.find({ guildId }).lean();
  const ops = levels.map((l) => ({
    updateOne: {
      filter: { guildId, userId: l.userId, year },
      update: { $setOnInsert: { level: l.level, xp: l.xp, createdAt: new Date() } },
      upsert: true,
    },
  }));
  if (ops.length) await LevelSnapshotModel.bulkWrite(ops);
  logger.info(`[WRAPPED] Level snapshots taken for guild ${guildId}: ${ops.length} users (year=${year}).`);
}

/**
 * Sends "Server Wrapped" automatically on November 11 (server birthday) at 12:00.
 * Posts to the channel configured in WrappedConfig.
 */
export default function run(client: Client): void {
  // November 11 at 12:00 (Europe/Warsaw)
  cron.schedule(
    '0 12 11 11 *',
    async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          const wrappedConfig = await WrappedConfigModel.findOne({
            guildId: guild.id,
            enabled: true,
          }).lean();

          if (!wrappedConfig?.channelId) continue;

          const channel = guild.channels.cache.get(wrappedConfig.channelId) as
            | TextChannel
            | undefined;
          if (!channel?.send) continue;

          logger.info(`[WRAPPED] Generuję Server Wrapped dla ${guild.name}...`);

          // Snapshot current levels before generating wrapped (for yearly growth)
          await takeLevelSnapshots(guild.id, new Date().getFullYear());

          const data = await collectWrappedData(guild);
          const imageBuffer = await renderWrappedCanvas(data);

          const attachment = new AttachmentBuilder(imageBuffer, {
            name: 'server-wrapped.png',
          });

          const ageText =
            data.ageYears === 1
              ? '1 rok'
              : data.ageYears < 5
                ? `${data.ageYears} lata`
                : `${data.ageYears} lat`;

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('wrapped:personal')
              .setLabel('🎁 TWOJE WRAPPED!')
              .setStyle(ButtonStyle.Primary),
          );

          await channel.send({
            content: `# 🎂 Wszystkiego najlepszego, **${guild.name}**!\nDzisiaj mija **${ageText}** od założenia serwera! Oto podsumowanie naszej wspólnej przygody:`,
            files: [attachment],
            components: [row],
          });

          logger.info(`[WRAPPED] Server Wrapped wysłany na #${channel.name} (${guild.name}).`);
        } catch (err) {
          logger.error(`[WRAPPED] Błąd dla guild=${guild.id}: ${err}`);
        }
      }
    },
    { timezone: 'Europe/Warsaw' },
  );

  logger.info('[WRAPPED] Zaplanowano Server Wrapped na 11 listopada, 12:00.');
}
