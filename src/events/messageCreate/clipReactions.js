const Clip = require("../../models/Clip");

const CLIPS_CHANNEL_ID = "1210246300843647047";
const VALID_REACTIONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

module.exports = async (message) => {
  try {
    if (
      message.channelId !== CLIPS_CHANNEL_ID ||
      !message.content.includes("#tryhard")
    ) {
      return;
    }

    const clip = new Clip({
      messageId: message.id,
      authorId: message.author.id,
      messageLink: message.url,
    });

    await clip.save();
    console.log("Klip został zapisany w bazie danych.");

    for (const reaction of VALID_REACTIONS) {
      await message.react(reaction);
    }
  } catch (error) {
    console.error("Błąd podczas przetwarzania nowej wiadomości:", error);
  }
};
