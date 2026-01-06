import { Client, ChannelType, TextChannel } from 'discord.js';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import { QuestionModel } from '../../models/Question';
import { UsedQuestionModel } from '../../models/UsedQuestion';
import logger from '../../utils/logger';
import { schedule } from 'node-cron';

export default async function run(client: Client): Promise<void> {
  schedule(
    '0 0 10 * * *',
    async () => {
      try {
        const questionConfigs = await QuestionConfigurationModel.find();
        
        if (questionConfigs.length === 0) {
          logger.info('Brak skonfigurowanych gildii z pytaniami dnia');
          return;
        }

        logger.info(`Wysyłanie pytań dnia dla ${questionConfigs.length} gildii...`);

        for (const questionConfig of questionConfigs) {
          try {
            const channel = client.channels.cache.get(questionConfig.questionChannelId);
            if (!channel || !('send' in channel)) {
              logger.warn(`[${questionConfig.guildId}] Kanał pytań nie istnieje lub nie jest tekstowy!`);
              continue;
            }
            const questionChannel = channel as TextChannel;

            const usedQuestionIds = await UsedQuestionModel.find({ guildId: questionConfig.guildId }).distinct('questionId');
            const questions = await QuestionModel.find({ questionId: { $nin: usedQuestionIds } });
            
            if (questions.length === 0) {
              logger.info(`[${questionConfig.guildId}] Brak dostępnych pytań (wszystkie zostały już użyte)`);
              await questionChannel.send('Brak dostępnych pytań - wszystkie pytania zostały już zadane! Poproś administratora o dodanie nowych pytań.');
              continue;
            }

            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

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

            await UsedQuestionModel.create({
              guildId: questionConfig.guildId,
              questionId: randomQuestion.questionId,
              usedAt: new Date(),
            });
            
            logger.info(`[${questionConfig.guildId}] Wysłano pytanie dnia: ${randomQuestion.content.slice(0, 50)}... (ID: ${randomQuestion.questionId})`);
          } catch (error) {
            logger.error(`[${questionConfig.guildId}] Błąd wysyłania pytania dnia: ${error}`);
          }
        }
        
        logger.info('Zakończono wysyłanie pytań dnia dla wszystkich gildii');
      } catch (error) {
        logger.error(`Błąd w schedulerze pytań dnia: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
