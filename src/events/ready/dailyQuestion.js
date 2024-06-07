const { ChannelType } = require('discord.js');
const Question = require('../../models/Question');
const QuestionConfiguration = require('../../models/QuestionConfiguration');
const cron = require('node-cron');
const { GUILD_ID } = process.env;

module.exports = async (client) => {
    const job = cron.schedule('0 0 10 * * *', async () => {
        try {
            const questionConfig = await QuestionConfiguration.findOne({ guildId: GUILD_ID });

            if (!questionConfig) {
                console.error('Konfiguracja kanału pytań nie istnieje!');
                return;
            }

            const questionChannel = client.channels.cache.get(questionConfig.questionChannelId);

            if (!questionChannel) {
                console.error('Kanał pytań nie istnieje!');
                return;
            }

            const questions = await Question.find();

            if (questions.length > 0) {
                const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

                let question;

                let threadName = randomQuestion.content;

                if (threadName.length > 100) {
                    threadName = threadName.slice(0, 97) + '...';
                }

                if (questionConfig.pingRoleId) {
                    question = await questionChannel.send(`<@&${questionConfig.pingRoleId}>\n\n**Pytanie dnia:**\n${randomQuestion.content}`);
                } else {
                    question = await questionChannel.send(`**Pytanie dnia:**\n${randomQuestion.content}`);
                }

                const thread = await questionChannel.threads.create({
                    name: threadName,
                    autoArchiveDuration: 1440,
                    type: ChannelType.PublicThread,
                    startMessage: question,
                });

                randomQuestion.reactions.forEach(async (reaction) => {
                    try {
                        await question.react(reaction);
                    } catch (error) {
                        console.error('Błąd podczas dodawania reakcji:', error);
                    }
                });

                await Question.findByIdAndDelete(randomQuestion._id);
            } else {
                questionChannel.send('Brak pytań w bazie danych!');
            }

        } catch (error) {
            console.error('Błąd wysyłania pytania dnia:', error);
        }
    });
}
