const Question = require('../../models/Question');
const QuestionConfiguration = require('../../models/QuestionConfiguration');
const cron = require('node-cron');
const { GUILD_ID } = process.env;

module.exports = ({ client }) => {
    cron.schedule('0 10 * * *', async () => { // Wykona się o 10:00 każdego dnia
        try {
            const config = await QuestionConfiguration.findOne({ guildId: GUILD_ID });

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
                } else {
                    console.error('Kanał z pytaniami nie istnieje!');
                }
            } else {
                console.error('Konfiguracja pytań nie istnieje!');
            }
        } catch (error) {
            console.error('Błąd wysyłania pytania dnia:', error);
        }
    });
}