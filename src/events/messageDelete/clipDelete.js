const Clip = require("../../models/Clip");
const logger = require("../../utils/logger");

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
          }
          return;
        }
        logger.error(
          `Błąd podczas pobierania pełnych danych wiadomości: ${
            error.code || error
          }`
        );
        return;
      }
    }

    if (message.channelId === CLIPS_CHANNEL_ID) {
      await Clip.findOneAndDelete({
        messageId: message.id,
      });
    }
  } catch (error) {
    logger.error("Błąd podczas usuwania klipu:", {
      errorMessage: error.message,
      errorCode: error.code,
      messageId: message?.id,
      channelId: message?.channelId,
    });
  }
};
