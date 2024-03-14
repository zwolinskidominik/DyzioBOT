const Question = require('../../models/Question');
const QuestionConfiguration = require('../../models/QuestionConfiguration');
const cron = require('node-cron');

module.exports = ({ interaction, client }) => {
    cron.schedule('1 * * * *', async () => { // Wykona się o 10:00 każdego dnia
        try {
            const config = await QuestionConfiguration.findOne({ guildId: guild.id });

            if (config) {
                const questionChannel = guild.channels.cache.get(config.questionChannelId);
                if (questionChannel) {
                    const questions = await Question.find();

                    if (questions.length > 0) {
                        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

                        questionChannel.send(`**Pytanie dnia:** ${randomQuestion.content}`);

                        await Question.findByIdAndDelete(randomQuestion._id);
                    } else {
                        questionChannel.send('Brak pytań w bazie danych!');
                    }
                }
            }
        } catch (error) {
            console.error('Błąd wysyłania pytania dnia:', error);
        }
    });
}