const { checkGlobalCooldown } = require("../utils/cooldown");
const { InteractionType } = require("discord.js");

/**
 * Globalna walidacja cooldownu dla komend typu chat input.
 * Jeśli użytkownik jest nadal na cooldownie, wysyła komunikat (reply lub followUp)
 * i zatrzymuje dalsze wykonanie komendy.
 *
 * @param {Interaction} interaction - Obiekt interakcji Discord (ChatInputCommandInteraction)
 * @returns {Promise<boolean>} - Zwraca true, jeśli użytkownik jest na cooldownie (i komenda nie zostanie wykonana), w przeciwnym razie false.
 */
module.exports = async (interaction) => {
  if (interaction.interaction.type !== InteractionType.ApplicationCommand)
    return;

  if (!interaction.interaction.user || !interaction.interaction.user.id) return;

  const timeLeft = checkGlobalCooldown(interaction.interaction.user.id);
  if (timeLeft > 0) {
    const replyData = {
      content: `Odczekaj jeszcze ${timeLeft.toFixed(
        1
      )} sekundy przed użyciem komendy ponownie.`,
      ephemeral: true,
    };

    if (!interaction.interaction.replied && !interaction.interaction.deferred) {
      await interaction.interaction.reply(replyData);
    } else {
      await interaction.interaction.followUp(replyData);
    }
    return true;
  }
  return false;
};
