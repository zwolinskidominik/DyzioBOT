import cron from 'node-cron';
import { flushMonthlyStats } from '../../cache/monthlyStatsCache';
import { CRON } from '../../config/constants/cron';

export function startMonthlyStatsFlushScheduler() {
  cron.schedule(CRON.MONTHLY_STATS_FLUSH, () => {
    flushMonthlyStats().catch(() => null);
  });
}

export default function run() {
  startMonthlyStatsFlushScheduler();
}
