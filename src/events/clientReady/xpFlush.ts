import cron from 'node-cron';
import cache from '../../cache/xpCache';
import { LevelModel } from '../../models/Level';
import { ActivityBucketModel } from '../../models/ActivityBucket';

export default async function flushXp() {
  const batch = cache.drain();
  if (!batch.length) {
    return;
  }

  const lvlOps: any[] = [];
  const bucketOps: any[] = [];

  for (const [key, entry] of batch) {
    const [guildId, userId] = key.split(':');

    lvlOps.push({
      updateOne: {
        filter: { guildId, userId },
        update: {
          $set: {
            xp: entry.persistedXp + entry.levelDelta,
            level: entry.persistedLevel,
          },
          $max: {
            lastMessageTs: entry.lastMessageTs,
            lastVcUpdateTs: entry.lastVcUpdateTs,
          },
        },
        upsert: true,
      },
    });

    bucketOps.push({
      updateOne: {
        filter: { guildId, userId, bucketStart: entry.bucketStart },
        update: {
          $inc: {
            msgCount: entry.bucket.msgCount,
            vcMin: entry.bucket.vcMin,
          },
        },
        upsert: true,
      },
    });
  }

  try {
    if (lvlOps.length) {
      await LevelModel.bulkWrite(lvlOps);
    }
    if (bucketOps.length) {
      await ActivityBucketModel.bulkWrite(bucketOps);
    }
  } catch (err) {
    console.error('[XP-FLUSH] Error during flush:', err);
  }
}

export function startXpFlushScheduler() {
  cron.schedule('*/5 * * * *', () => {
    flushXp().catch((err) => console.error('[XP-FLUSH CRON]', err));
  });
}
