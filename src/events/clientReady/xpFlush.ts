import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { flush } from '../../services/xpService';
import logger from '../../utils/logger';

export default async function flushXp() {
  await flush();
}

export function startXpFlushScheduler() {
  cron.schedule(CRON.XP_FLUSH, () => {
    flushXp().catch((err) => logger.error(`[XP-FLUSH CRON] ${err}`));
  });
}
