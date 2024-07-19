const { PollLayoutType } = require("discord.js");
const Poll = require("../../models/Poll");
const QuestionConfiguration = require("../../models/QuestionConfiguration");
const cron = require("node-cron");
const { GUILD_ID } = process.env;

module.exports = async (client) => {
  cron.schedule("0 0 10 * * *", async () => {
    try {
      const questionConfig = await QuestionConfiguration.findOne({
        guildId: GUILD_ID,
      });

      if (!questionConfig) {
        console.error("Konfiguracja kanału pytań nie istnieje!");
        return;
      }

      const questionChannel = client.channels.cache.get(
        questionConfig.questionChannelId
      );
      if (!questionChannel) {
        console.error("Kanał pytań nie istnieje!");
        return;
      }

      const questions = await Poll.find();
      if (questions.length === 0) {
        questionChannel.send("Brak pytań w bazie danych!");
        return;
      }

      const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];

      const answers = randomQuestion.answers
        .filter((answer) => answer.text && answer.emoji)
        .map((answer, index) => ({
          text: answer.text,
          emoji: answer.emoji,
        }));

      const pollData = {
        poll: {
          question: { text: randomQuestion.content },
          answers,
          allowMultiselect: randomQuestion.allowMultiselect,
          duration: 168,
          layoutType: PollLayoutType.Default,
        },
      };

      const messageContent = questionConfig.pingRoleId
        ? `<@&${questionConfig.pingRoleId}>:`
        : ``;

      await questionChannel.send({ content: messageContent, ...pollData });

      await Poll.findByIdAndDelete(randomQuestion._id);
    } catch (error) {
      console.error("Błąd wysyłania pytania dnia:", error);
    }
  });
};
