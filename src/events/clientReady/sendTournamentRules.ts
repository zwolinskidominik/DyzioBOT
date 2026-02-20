import { Client, TextChannel, ChannelType } from 'discord.js';
import logger from '../../utils/logger';
import { getGuildConfig } from '../../config/guild';
import { schedule, ScheduledTask } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { TournamentConfigModel } from '../../models/TournamentConfig';

let scheduledTask: ScheduledTask | null = null;

export default async function run(client: Client): Promise<void> {
  const setupSchedule = async () => {
    try {
      const tournamentConfig = await TournamentConfigModel.findOne();
      
      if (!tournamentConfig || !tournamentConfig.enabled) {
        return;
      }

      if (scheduledTask) {
        scheduledTask.stop();
      }

      scheduledTask = schedule(
        tournamentConfig.cronSchedule || CRON.TOURNAMENT_RULES_DEFAULT,
        async () => {
          try {
            const channelId = tournamentConfig.channelId;
            if (!channelId) {
              logger.warn('Brak skonfigurowanego kanału dla turnieju.');
              return;
            }

            const tournamentChannel = client.channels.cache.get(channelId);
            if (
              !tournamentChannel ||
              (tournamentChannel.type !== ChannelType.GuildText &&
                tournamentChannel.type !== ChannelType.GuildAnnouncement)
            ) {
              logger.warn('Kanał do wysyłania zasad turnieju nie istnieje lub nie jest tekstowy!');
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
            const organizerUserPings = organizerUserIds.map(id => `<@${id}>`).join(' ');
            const voiceChannelLink = voiceChannelId 
              ? `https://discord.com/channels/${guild.id}/${voiceChannelId}`
              : '**kanale głosowym CS2**';

            const currentConfig = await TournamentConfigModel.findOne();
            if (!currentConfig || !currentConfig.enabled) {
              logger.info('Turniej został wyłączony');
              return;
            }

            let message = currentConfig.messageTemplate;
            message = message.replace(/{roleMention}/g, roleMention);
            message = message.replace(/{organizerRoleMention}/g, organizerRoleMention);
            message = message.replace(/{organizerUserPings}/g, organizerUserPings);
            message = message.replace(/{voiceChannelLink}/g, voiceChannelLink);

            const rulesMessage = await textChannel.send(message);
            await rulesMessage.react(currentConfig.reactionEmoji || '🎮');
          } catch (error) {
            logger.error(`Błąd wysyłania zasad turnieju: ${error}`);
          }
        },
        {
          timezone: 'Europe/Warsaw',
        }
      );

      logger.info(`Harmonogram turnieju zaplanowany: ${tournamentConfig.cronSchedule}`);
    } catch (error) {
      logger.error(`Błąd konfiguracji harmonogramu turnieju: ${error}`);
    }
  };

  await setupSchedule();
}
