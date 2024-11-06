const Clip = require("../../models/Clip");
const CLIPS_CHANNEL_ID = "1210246300843647047";

module.exports = async (message) => {
  try {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (error) {
        if (error.code === 10008) {
          if (message.channelId === CLIPS_CHANNEL_ID) {
            await Clip.deleteOne({ messageId: message.id });
            console.log(
              `Klip (ID: ${message.id}) został usunięty z bazy danych.`
            );
          }
          return;
        }

        console.error(
          "Błąd podczas pobierania pełnych danych wiadomości:",
          error.code ? `Kod błędu: ${error.code}` : error
        );
        return;
      }
    }

    if (message.channelId === CLIPS_CHANNEL_ID) {
      const deletedClip = await Clip.findOneAndDelete({
        messageId: message.id,
      });

      if (deletedClip) {
        console.log(
          `Klip "${deletedClip.name}" został usunięty z bazy danych.`
        );
      } else {
        console.log(
          `Nie znaleziono klipu o ID wiadomości: ${message.id} w bazie danych.`
        );
      }
    }
  } catch (error) {
    console.error("Błąd podczas usuwania klipu:", {
      errorMessage: error.message,
      errorCode: error.code,
      messageId: message?.id,
      channelId: message?.channelId,
    });
  }
};
