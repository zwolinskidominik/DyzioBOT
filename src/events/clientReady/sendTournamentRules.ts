import { Client, TextChannel, ChannelType } from 'discord.js';
import logger from '../../utils/logger';
import { env } from '../../config';
import { getGuildConfig } from '../../config/guild';
import { schedule, ScheduledTask } from 'node-cron';
import { TournamentConfigModel } from '../../models/TournamentConfig';

const { TOURNAMENT_CHANNEL_ID } = env();

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
        tournamentConfig.cronSchedule || '25 20 * * 1',
        async () => {
          try {
            const channelId = TOURNAMENT_CHANNEL_ID;
            if (!channelId) {
              logger.warn('Brak zmiennej środowiskowej TOURNAMENT_CHANNEL_ID.');
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

  setInterval(setupSchedule, 60 * 60 * 1000);
}
