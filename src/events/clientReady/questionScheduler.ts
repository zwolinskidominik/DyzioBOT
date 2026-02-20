import { Client, ChannelType, TextChannel } from 'discord.js';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import { getRandomQuestion, markUsed } from '../../services/questionService';
import logger from '../../utils/logger';
import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.QUESTION_POST,
    async () => {
      try {
        const questionConfigs = await QuestionConfigurationModel.find();
        
        if (questionConfigs.length === 0) {
          return;
        }

        for (const questionConfig of questionConfigs) {
          try {
            const channel = client.channels.cache.get(questionConfig.questionChannelId);
            if (!channel || !('send' in channel)) {
              logger.warn(`[${questionConfig.guildId}] Kanał pytań nie istnieje lub nie jest tekstowy!`);
              continue;
            }
            const questionChannel = channel as TextChannel;

            const questionResult = await getRandomQuestion();
            
            if (!questionResult.ok) {
              logger.info(`[${questionConfig.guildId}] Brak dostępnych pytań (wszystkie zostały już użyte)`);
              await questionChannel.send('Brak dostępnych pytań - wszystkie pytania zostały już zadane! Poproś administratora o dodanie nowych pytań.');
              continue;
            }

            const randomQuestion = questionResult.data;

            let threadName = randomQuestion.content.slice(0, 97);
            if (randomQuestion.content.length > 97) threadName += '...';

            const messageContent = questionConfig.pingRoleId
              ? `<@&${questionConfig.pingRoleId}>\n\n**Pytanie dnia:**\n${randomQuestion.content}`
              : `**Pytanie dnia:**\n${randomQuestion.content}`;

            const questionMessage = await questionChannel.send(messageContent);

            await questionChannel.threads.create({
              name: threadName,
              autoArchiveDuration: 1440,
              type: ChannelType.PublicThread,
              startMessage: questionMessage,
            });

            for (const reaction of randomQuestion.reactions) {
              try {
                await questionMessage.react(reaction);
              } catch (error) {
                logger.warn(`[${questionConfig.guildId}] Błąd podczas dodawania reakcji "${reaction}": ${error}`);
              }
            }

            await markUsed(randomQuestion.questionId);
          } catch (error) {
            logger.error(`[${questionConfig.guildId}] Błąd wysyłania pytania dnia: ${error}`);
          }
        }
      } catch (error) {
        logger.error(`Błąd w schedulerze pytań dnia: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
