const { ChannelType } = require("discord.js");
const Question = require("../../models/Question");
const QuestionConfiguration = require("../../models/QuestionConfiguration");
const cron = require("node-cron");
const { GUILD_ID } = process.env;

module.exports = async (client) => {
  cron.schedule("0 0 8 * * *", async () => {
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

      const questions = await Question.find();
      if (questions.length === 0) {
        questionChannel.send("Brak pytań w bazie danych!");
        return;
      }

      const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];
      let threadName = randomQuestion.content.slice(0, 97);
      if (randomQuestion.content.length > 97) threadName += "...";

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

      randomQuestion.reactions.forEach(async (reaction) => {
        try {
          await questionMessage.react(reaction);
        } catch (error) {
          console.error("Błąd podczas dodawania reakcji:", error);
        }
      });

      await Question.findByIdAndDelete(randomQuestion._id);
    } catch (error) {
      console.error("Błąd wysyłania pytania dnia:", error);
    }
  });
};
