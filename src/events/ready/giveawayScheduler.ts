import { schedule } from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { GiveawayModel } from '../../models/Giveaway';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { pickWinners } from '../../utils/giveawayHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  schedule(
    '* * * * *',
    async () => {
      try {
        const endedGiveaways = await GiveawayModel.find({
          active: true,
          endTime: { $lte: new Date() },
        });

        if (endedGiveaways.length === 0) {
          return;
        }

        for (const giveaway of endedGiveaways) {
          try {
            giveaway.active = false;
            await giveaway.save();

            const guild = client.guilds.cache.get(giveaway.guildId);
            if (!guild) {
              logger.warn(`Nie znaleziono serwera o ID: ${giveaway.guildId}`);
              continue;
            }

            const channel = guild.channels.cache.get(giveaway.channelId);
            if (!channel || !('messages' in channel)) {
              logger.warn(
                `Nie znaleziono kanału o ID: ${giveaway.channelId} lub nie jest to kanał tekstowy`
              );
              continue;
            }

            const textChannel = channel as TextChannel;

            let giveawayMessage;
            try {
              giveawayMessage = await textChannel.messages.fetch(giveaway.messageId);
            } catch (error) {
              logger.warn(
                `Nie można pobrać wiadomości giveaway (ID: ${giveaway.messageId}): ${error}`
              );
              continue;
            }

            const winners = await pickWinners(giveaway.participants, giveaway.winnersCount, guild);
            const winnersText = winners.length
              ? winners.map((user) => `<@${user.id}>`).join(', ')
              : 'Brak zwycięzców';

            const participantsCount = giveaway.participants.length;
            const timestamp = getTimestamp(giveaway.endTime);

            const updatedEmbed = createBaseEmbed({
              description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
              footerText: `Giveaway ID: ${giveaway.giveawayId}`,
              color: COLORS.GIVEAWAY_ENDED,
            });

            await giveawayMessage.edit({
              embeds: [updatedEmbed],
              components: [],
            });

            if (winners.length > 0) {
              await giveawayMessage.reply({
                content: `🎉 Gratulacje ${winners.map((user) => `<@${user.id}>`).join(', ')}! **${giveaway.prize}** jest Twoje!`,
              });
            } else {
              await giveawayMessage.reply({
                content:
                  'Brak wystarczającej liczby uczestników, więc nie udało się wyłonić zwycięzcy!',
              });
            }
          } catch (error) {
            logger.error(`Błąd podczas kończenia giveaway ${giveaway.giveawayId}: ${error}`);
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
