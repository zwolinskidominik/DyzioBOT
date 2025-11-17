import { Client, TextChannel, ChannelType } from 'discord.js';
import logger from '../../utils/logger';
import { env } from '../../config';
import { getGuildConfig } from '../../config/guild';
import { schedule } from 'node-cron';

const { TOURNAMENT_CHANNEL_ID } = env();

export default async function run(client: Client): Promise<void> {
  schedule(
    '25 20 * * 1',
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

        const rulesMessage =
          await textChannel.send(`# Zasady co poniedziałkowych mixów 5vs5 ${roleMention}
**Do kogo można się zgłaszać z dodatkowymi pytaniami o turniej?** 
 ${organizerRoleMention}: ${organizerUserPings}
### Zbiórka i start
-# Zbieramy się na kanale głosowym ${voiceChannelLink} o godzinie **20:30 w każdy poniedziałek**. Do turnieju może dołączyć **każdy** zainteresowany rywalizacją i dobrą zabawą. Następnie przechodzimy do **losowania drużyn** na kole fortuny.
### Zakaz używania cheatów
-# Używanie programów wspomagających jest surowo zabronione. Turniej opiera się na uczciwej rywalizacji i dobrej atmosferze!
### Eksperymentowanie z bronią
-# Zeusy, kosy, granaty oraz wszelkie nietypowe bronie są mile widziane! Staraj się nie tryhardować - to nie jest mecz o rangę!
### Kultura
-# Szanujmy zarówno przeciwników, jak i swoich teammate'ów. Obrażanie, negatywne komentarze lub wyzwiska są zabronione – celem jest pozytywna atmosfera i dobra zabawa.`);
        await rulesMessage.react('🎮');
      } catch (error) {
        logger.error(`Błąd wysyłania zasad turnieju: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
