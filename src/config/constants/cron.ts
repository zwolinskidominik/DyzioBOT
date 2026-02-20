/**
 * Centralized cron schedule expressions used by all schedulers.
 *
 * Standard cron:    minute hour day month weekday
 * 6-field cron:     second minute hour day month weekday
 */
export const CRON = {
  /** Daily at 09:00 — birthday announcements */
  BIRTHDAY_CHECK: '0 9 * * *',

  /** 1st of each month at 12:00 — generate monthly stats */
  MONTHLY_STATS_GENERATE: '0 12 1 * *',

  /** Daily at 10:00 (6-field: seconds=0) — post scheduled question */
  QUESTION_POST: '0 0 10 * * *',

  /** Default: Monday at 20:25 — send tournament rules (overridable in DB) */
  TOURNAMENT_RULES_DEFAULT: '25 20 * * 1',

  /** Daily at midnight — clean up old Twitch thumbnails */
  TWITCH_THUMBNAIL_CLEANUP: '0 0 * * *',

  /** Every minute — check Twitch streams */
  TWITCH_STREAM_CHECK: '* * * * *',

  /** Every 5 minutes — flush monthly stats cache to DB */
  MONTHLY_STATS_FLUSH: '*/5 * * * *',

  /** Every 30 seconds (6-field) — voice-channel XP tick */
  VC_MINUTE_TICK: '*/30 * * * * *',

  /** Daily at midnight — warn expiry maintenance */
  WARN_MAINTENANCE: '0 0 * * *',

  /** Every minute — scan for ended giveaways */
  GIVEAWAY_CHECK: '* * * * *',

  /** Every 5 minutes — flush XP cache to DB */
  XP_FLUSH: '*/5 * * * *',

  /** Every 10 minutes — update channel statistics */
  CHANNEL_STATS_UPDATE: '*/10 * * * *',
} as const;
