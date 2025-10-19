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
        const scanNow = new Date();
        const candidates = await GiveawayModel.find({
          endTime: { $lte: scanNow },
          finalized: false,
        })
          .select('giveawayId endTime active finalized')
          .sort({ endTime: 1 })
          .lean();
        let processedCount = 0;

        while (true) {
          const now = new Date();
          const giveaway = await GiveawayModel.findOneAndUpdate(
            { finalized: false, endTime: { $lte: now } },
            { active: false },
            { returnDocument: 'after', sort: { endTime: 1 } }
          );
          if (!giveaway) {
            break;
          }

          processedCount++;
          try {
            const guild = client.guilds.cache.get(giveaway.guildId);
            if (!guild) {
              logger.warn(
                `Nie znaleziono serwera o ID: ${giveaway.guildId} dla giveaway ${giveaway.giveawayId}`
              );
              // Mark as finalized to prevent infinite loop
              await GiveawayModel.updateOne(
                { _id: giveaway._id },
                { $set: { finalized: true } }
              );
              continue;
            }

            const channel = guild.channels.cache.get(giveaway.channelId);
            if (!channel || !('messages' in channel)) {
              logger.warn(
                `Nie znaleziono kanału o ID: ${giveaway.channelId} lub nie jest to kanał tekstowy dla giveaway ${giveaway.giveawayId}`
              );
              // Mark as finalized to prevent infinite loop
              await GiveawayModel.updateOne(
                { _id: giveaway._id },
                { $set: { finalized: true } }
              );
              continue;
            }

            const textChannel = channel as TextChannel;

            let giveawayMessage;
            try {
              giveawayMessage = await textChannel.messages.fetch(giveaway.messageId);
            } catch (error) {
              logger.error(
                `Nie można pobrać wiadomości giveaway ${giveaway.giveawayId} (messageId: ${giveaway.messageId}): ${error}`
              );
              // Mark as finalized to prevent infinite loop
              await GiveawayModel.updateOne(
                { _id: giveaway._id },
                { $set: { finalized: true } }
              );
              continue;
            }

            const winners = await pickWinners(giveaway.participants, giveaway.winnersCount, guild);
            const winnersText = winners.length
              ? winners.map((user) => `<@${user.id}>`).join(', ')
              : 'Brak zwycięzców';

            if (!winners.length && giveaway.participants.length > 0) {
              logger.warn(
                `Brak zwycięzców mimo uczestników (giveaway=${giveaway.giveawayId}) – możliwe błędy fetch członków. Sprawdź uprawnienia GUILD_MEMBERS / intents.`
              );
            }

            const participantsCount = giveaway.participants.length;
            const timestamp = getTimestamp(giveaway.endTime);

            const updatedEmbed = createBaseEmbed({
              description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Zakończony:** <t:${timestamp}:f>\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
              footerText: `Giveaway ID: ${giveaway.giveawayId}`,
              color: COLORS.GIVEAWAY_ENDED,
            });

            try {
              await giveawayMessage.edit({
                embeds: [updatedEmbed],
                components: [],
              });
              logger.info(`Zaktualizowano wiadomość giveaway ${giveaway.giveawayId}`);
            } catch (editError) {
              logger.error(
                `Błąd podczas edycji wiadomości giveaway ${giveaway.giveawayId}: ${editError}`
              );
            }

            try {
              const winnerContent = winners.length
                ? `🎉 Gratulacje ${winners
                    .map((user) => `<@${user.id}>`)
                    .join(', ')}! **${giveaway.prize}** jest Twoje!`
                : 'Brak wystarczającej liczby uczestników, więc nie udało się wyłonić zwycięzcy!';

              let sent = false;
              try {
                await giveawayMessage.reply({ content: winnerContent });
                sent = true;
                logger.debug(
                  `giveawayScheduler: reply wysłany (giveaway=${giveaway.giveawayId}, via=reply)`
                );
              } catch (replyErr) {
                logger.warn(
                  `Nie udało się wysłać reply (spróbuję channel.send) giveaway=${giveaway.giveawayId}: ${replyErr}`
                );
              }
              if (!sent) {
                try {
                  await textChannel.send({
                    content: winnerContent,
                    reply: { messageReference: giveawayMessage.id },
                  });
                  sent = true;
                  logger.debug(
                    `giveawayScheduler: wiadomość wysłana fallback channel.send (giveaway=${giveaway.giveawayId})`
                  );
                } catch (fallbackErr) {
                  logger.error(
                    `Nie udało się wysłać wiadomości (reply ani channel.send) giveaway=${giveaway.giveawayId}: ${fallbackErr}`
                  );
                }
              }
              if (sent) {
                logger.info(`Wysłano wiadomość z wynikami giveaway ${giveaway.giveawayId}`);
              }

              try {
                await GiveawayModel.updateOne(
                  { _id: giveaway._id, finalized: false },
                  { $set: { finalized: true } }
                );
              } catch (finErr) {
                logger.error(
                  `Nie udało się ustawić finalized=true (giveaway=${giveaway.giveawayId}): ${finErr}`
                );
              }
            } catch (replyError) {
              logger.error(
                `Błąd podczas końcowego ogłoszenia zwycięzców giveaway ${giveaway.giveawayId}: ${replyError}`
              );
            }
          } catch (error) {
            logger.error(`Błąd podczas kończenia giveaway ${giveaway.giveawayId}: ${error}`);
          }
        }

        if (processedCount > 0) {
          logger.info(
            `Przetworzono ${processedCount} zakończonych giveaway'ów (początkowych kandydatów=${candidates.length}) o ${new Date().toISOString()}`
          );
        } else if (candidates.length > 0) {
          logger.warn(
            `Scheduler: znaleziono ${candidates.length} kandydatów w skanie, ale processed=0. Sprawdź różnice czasowe endTime vs now oraz uprawnienia.`
          );
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
