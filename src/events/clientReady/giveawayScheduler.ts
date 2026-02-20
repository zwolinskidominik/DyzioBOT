import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { Client, TextChannel } from 'discord.js';
import { finalizeExpiredGiveaways } from '../../services/giveawayService';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.GIVEAWAY_CHECK,
    async () => {
      try {
        const result = await finalizeExpiredGiveaways();
        if (!result.ok) return;

        for (const entry of result.data) {
          try {
            const guild = client.guilds.cache.get(entry.guildId);
            if (!guild) {
              logger.warn(
                `Nie znaleziono serwera o ID: ${entry.guildId} dla giveaway ${entry.giveawayId}`
              );
              continue;
            }

            const channel = guild.channels.cache.get(entry.channelId);
            if (!channel || !('messages' in channel)) {
              logger.warn(
                `Nie znaleziono kanału o ID: ${entry.channelId} lub nie jest to kanał tekstowy dla giveaway ${entry.giveawayId}`
              );
              continue;
            }

            const textChannel = channel as TextChannel;

            let giveawayMessage;
            try {
              giveawayMessage = await textChannel.messages.fetch(entry.messageId);
            } catch (error) {
              logger.error(
                `Nie można pobrać wiadomości giveaway ${entry.giveawayId} (messageId: ${entry.messageId}): ${error}`
              );
              continue;
            }

            const winnersText = entry.winnerIds.length
              ? entry.winnerIds.map((id) => `<@${id}>`).join(', ')
              : 'Brak zwycięzców';

            if (!entry.winnerIds.length && entry.participants.length > 0) {
              logger.warn(
                `Brak zwycięzców mimo uczestników (giveaway=${entry.giveawayId}) – uczest. w puli: ${entry.participants.length}`
              );
            }

            const participantsCount = entry.participants.length;
            const timestamp = getTimestamp(entry.endTime);

            const updatedEmbed = createBaseEmbed({
              description: `### ${entry.prize}\n${entry.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${entry.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
              footerText: `Giveaway ID: ${entry.giveawayId}`,
              color: COLORS.GIVEAWAY_ENDED,
            });

            try {
              await giveawayMessage.edit({
                embeds: [updatedEmbed],
                components: [],
              });
            } catch (editError) {
              logger.error(
                `Błąd podczas edycji wiadomości giveaway ${entry.giveawayId}: ${editError}`
              );
            }

            const winnerContent = entry.winnerIds.length
              ? `🎉 Gratulacje ${entry.winnerIds.map((id) => `<@${id}>`).join(', ')}! **${entry.prize}** jest Twoje!`
              : 'Brak wystarczającej liczby uczestników, więc nie udało się wyłonić zwycięzcy!';

            let sent = false;
            try {
              await giveawayMessage.reply({ content: winnerContent });
              sent = true;
            } catch (replyErr) {
              logger.warn(
                `Nie udało się wysłać reply (spróbuję channel.send) giveaway=${entry.giveawayId}: ${replyErr}`
              );
            }
            if (!sent) {
              try {
                await textChannel.send({
                  content: winnerContent,
                  reply: { messageReference: giveawayMessage.id },
                });
              } catch (fallbackErr) {
                logger.error(
                  `Nie udało się wysłać wiadomości (reply ani channel.send) giveaway=${entry.giveawayId}: ${fallbackErr}`
                );
              }
            }
          } catch (error) {
            logger.error(`Błąd podczas kończenia giveaway ${entry.giveawayId}: ${error}`);
          }
        }
      } catch (error) {
        logger.error(`Błąd przy sprawdzaniu zakończonych giveawayów: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}

function getTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
