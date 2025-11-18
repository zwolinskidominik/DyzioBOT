import cron from 'node-cron';
import { flushMonthlyStats } from '../../cache/monthlyStatsCache';

export function startMonthlyStatsFlushScheduler() {
  cron.schedule('*/5 * * * *', () => {
    flushMonthlyStats().catch(() => null);
  });
}

export default function run() {
  startMonthlyStatsFlushScheduler();
}
