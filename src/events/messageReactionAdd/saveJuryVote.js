const Clip = require("../../models/Clip");

const JURY_ROLE_ID = "1303735601845239969";
const REACTION_TO_SCORE = {
  "1️⃣": 1,
  "2️⃣": 2,
  "3️⃣": 3,
  "4️⃣": 4,
  "5️⃣": 5,
  "6️⃣": 6,
};

module.exports = async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error("Błąd podczas pobierania pełnych danych reakcji:", error);
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (error) {
        console.error(
          "Błąd podczas pobierania pełnych danych wiadomości:",
          error
        );
        return;
      }
    }

    const clip = await Clip.findOne({ messageId: reaction.message.id });
    if (!clip) {
      console.log("No clip found for this message.");
      return;
    }

    const member = await reaction.message.guild.members.fetch(user.id);
    if (!member.roles.cache.has(JURY_ROLE_ID)) {
      console.log("User does not have the jury role.");
      return;
    }

    const score = REACTION_TO_SCORE[reaction.emoji.name];
    if (!score) {
      console.log("Reaction is not a valid score.");
      return;
    }

    await Clip.updateOne(
      { messageId: reaction.message.id },
      { $pull: { votes: { juryId: user.id } } }
    );
    console.log("Previous vote removed if existed.");

    await Clip.updateOne(
      { messageId: reaction.message.id },
      { $push: { votes: { juryId: user.id, score } } }
    );
    console.log(`Vote added: ${user.id} scored ${score}`);
  } catch (error) {
    console.error("Błąd podczas przetwarzania reakcji:", error);
  }
};
