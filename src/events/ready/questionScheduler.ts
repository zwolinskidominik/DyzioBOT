import { Client, ChannelType, TextChannel } from 'discord.js';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import { QuestionModel } from '../../models/Question';
import logger from '../../utils/logger';
import { env } from '../../config';
import { schedule } from 'node-cron';

const { GUILD_ID } = env();

export default async function run(client: Client): Promise<void> {
  schedule(
    '0 0 10 * * *',
    async () => {
      try {
        const questionConfig = await QuestionConfigurationModel.findOne({ guildId: GUILD_ID });
        if (!questionConfig) {
          logger.warn('Konfiguracja kanału pytań nie istnieje!');
          return;
        }

        const channel = client.channels.cache.get(questionConfig.questionChannelId);
        if (!channel || !('send' in channel)) {
          logger.warn('Kanał pytań nie istnieje lub nie jest tekstowy!');
          return;
        }
        const questionChannel = channel as TextChannel;

        const questions = await QuestionModel.find();
        if (questions.length === 0) {
          logger.info('Brak pytań w bazie danych!');
          await questionChannel.send('Brak pytań w bazie danych!');
          return;
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
            logger.warn(`Błąd podczas dodawania reakcji "${reaction}": ${error}`);
          }
        }

        await QuestionModel.findByIdAndDelete(randomQuestion._id);
      } catch (error) {
        logger.error(`Błąd wysyłania pytania dnia: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
