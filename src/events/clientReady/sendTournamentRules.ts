import { Client, TextChannel, ChannelType } from 'discord.js';
import logger from '../../utils/logger';
import { getGuildConfig } from '../../config/guild';
import { schedule, ScheduledTask } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { TournamentConfigModel } from '../../models/TournamentConfig';

/** Map guildId → { task, cronExpression } for active tournament schedules. */
const activeTasks = new Map<string, { task: ScheduledTask; cron: string }>();

export default async function run(client: Client): Promise<void> {
  // Sync schedules on startup, then re-sync every minute to pick up
  // dashboard changes (enabled/disabled, schedule, channel, etc.)
  await syncSchedules(client);

  schedule(
    '* * * * *',
    async () => {
      try {
        await syncSchedules(client);
      } catch (err) {
        logger.error(`Błąd synchronizacji harmonogramów turnieju: ${err}`);
      }
    },
    { timezone: 'Europe/Warsaw' },
  );
}

/**
 * Read all tournament configs from DB and reconcile with active cron tasks.
 * - Creates tasks for newly-enabled configs.
 * - Removes tasks for disabled/deleted configs.
 * - Re-creates tasks when the cron expression changes.
 */
async function syncSchedules(client: Client): Promise<void> {
  const configs = await TournamentConfigModel.find().lean();

  const enabledGuildIds = new Set<string>();

  for (const cfg of configs) {
    if (!cfg.enabled) continue;
    enabledGuildIds.add(cfg.guildId);

    const cronExpr = cfg.cronSchedule || CRON.TOURNAMENT_RULES_DEFAULT;
    const existing = activeTasks.get(cfg.guildId);

    // Already scheduled with the same cron — nothing to do
    if (existing && existing.cron === cronExpr) continue;

    // Stop old task if the cron expression changed
    if (existing) {
      existing.task.stop();
      logger.info(`Turniej ${cfg.guildId}: harmonogram zmieniony → przeharmonogramowanie.`);
    }

    const task = schedule(
      cronExpr,
      async () => {
        await sendTournamentMessage(client, cfg.guildId);
      },
      { timezone: 'Europe/Warsaw' },
    );

    activeTasks.set(cfg.guildId, { task, cron: cronExpr });
    logger.info(`Turniej ${cfg.guildId}: zaplanowano (${cronExpr}).`);
  }

  // Remove tasks for configs that are no longer enabled
  for (const [guildId, entry] of activeTasks) {
    if (!enabledGuildIds.has(guildId)) {
      entry.task.stop();
      activeTasks.delete(guildId);
      logger.info(`Turniej ${guildId}: wyłączono — harmonogram usunięty.`);
    }
  }
}

/**
 * Actual message-sending logic.  Re-reads the full config from DB so it
 * always uses the latest channelId, template, and enabled flag.
 */
async function sendTournamentMessage(client: Client, guildId: string): Promise<void> {
  try {
    const config = await TournamentConfigModel.findOne({ guildId });
    if (!config || !config.enabled) {
      logger.info(`Turniej ${guildId}: wyłączony lub usunięty — pomijam.`);
      return;
    }

    const channelId = config.channelId;
    if (!channelId) {
      logger.warn(`Turniej ${guildId}: brak skonfigurowanego kanału.`);
      return;
    }

    const tournamentChannel = client.channels.cache.get(channelId);
    if (
      !tournamentChannel ||
      (tournamentChannel.type !== ChannelType.GuildText &&
        tournamentChannel.type !== ChannelType.GuildAnnouncement)
    ) {
      logger.warn(`Turniej ${guildId}: kanał ${channelId} nie istnieje lub nie jest tekstowy.`);
      return;
    }

    const textChannel = tournamentChannel as TextChannel;
    const guild = textChannel.guild;

    const guildConfig = getGuildConfig(guild.id);
    const tournamentRoleId = guildConfig.roles.tournamentParticipants;
    const organizerRoleId = guildConfig.roles.tournamentOrganizer;
    const organizerUserIds = guildConfig.tournament.organizerUserIds;
    const voiceChannelId = guildConfig.channels.tournamentVoice;

    const roleMention = tournamentRoleId ? `<@&${tournamentRoleId}>` : '';
    const organizerRoleMention = organizerRoleId ? `<@&${organizerRoleId}>` : '';
    const organizerUserPings = organizerUserIds.map((id) => `<@${id}>`).join(' ');
    const voiceChannelLink = voiceChannelId
      ? `https://discord.com/channels/${guild.id}/${voiceChannelId}`
      : '**kanale głosowym CS2**';

    let message = config.messageTemplate;
    message = message.replace(/{roleMention}/g, roleMention);
    message = message.replace(/{organizerRoleMention}/g, organizerRoleMention);
    message = message.replace(/{organizerUserPings}/g, organizerUserPings);
    message = message.replace(/{voiceChannelLink}/g, voiceChannelLink);

    const rulesMessage = await textChannel.send(message);
    await rulesMessage.react(config.reactionEmoji || '🎮');
    logger.info(`Turniej ${guildId}: wiadomość wysłana na kanale #${textChannel.name}.`);
  } catch (error) {
    logger.error(`Turniej ${guildId}: błąd wysyłania — ${error}`);
  }
}

/** Exposed for testing. */
export { syncSchedules, sendTournamentMessage, activeTasks };
