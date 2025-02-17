const { EmbedBuilder } = require("discord.js");

/**
 * Tworzy bazowy embed z możliwością ustawienia:
 *  - Domyślnych kolorów: #00BFFF (zwykły), #E74D3C (błąd, gdy isError = true)
 *  - Niestandardowego koloru (gdy options.color jest ustawione)
 *  - Tytułu, opisu, stopki
 *  - Obrazka (setImage)
 *  - Miniaturki (setThumbnail)
 *  - Autora (setAuthor)
 *  - URL embeda (setURL)
 *  - Timestamp (domyślnie włączony, chyba że jawnie wyłączony)
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.isError=false] - Czy embed ma być komunikatem błędu (kolor #E74D3C)
 * @param {string} [options.color=""] - Niestandardowy kolor (np. "#6441A5"); jeżeli ustawiony, nadpisuje isError
 * @param {string} [options.title=""] - Tytuł embeda
 * @param {string} [options.description=""] - Opis embeda
 * @param {string} [options.footerText=""] - Tekst w stopce
 * @param {string} [options.footerIcon=""] - Ikona w stopce (URL)
 * @param {string} [options.image=""] - URL do obrazu (setImage)
 * @param {string} [options.thumbnail=""] - URL do miniatury (setThumbnail)
 * @param {string} [options.authorName=""] - Nazwa autora (setAuthor)
 * @param {string} [options.authorIcon=""] - Ikona (URL) przy nazwie autora
 * @param {string} [options.authorUrl=""] - URL, który ma się otwierać po kliknięciu w autora
 * @param {string} [options.url=""] - URL całego embeda (np. po kliknięciu w tytuł)
 * @param {boolean} [options.timestamp=true] - Czy dodać timestamp do embeda (domyślnie true)
 * @returns {EmbedBuilder}
 */
function createBaseEmbed(options = {}) {
  const {
    isError = false,
    color = "",
    title = "",
    description = "",
    footerText = "",
    footerIcon = "",
    image = "",
    thumbnail = "",
    authorName = "",
    authorIcon = "",
    authorUrl = "",
    url = "",
    timestamp = true,
  } = options;

  const finalColor = color || (isError ? "#E74D3C" : "#00BFFF");

  const embed = new EmbedBuilder().setColor(finalColor);
  if (timestamp) embed.setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (footerText) {
    embed.setFooter({
      text: footerText,
      iconURL: footerIcon || undefined,
    });
  }
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (authorName) {
    embed.setAuthor({
      name: authorName,
      iconURL: authorIcon || undefined,
      url: authorUrl || undefined,
    });
  }
  if (url) embed.setURL(url);

  return embed;
}

module.exports = { createBaseEmbed };
