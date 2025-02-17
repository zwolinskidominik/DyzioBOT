const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Napisz coś za pomocą bota.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const channel = interaction.channel;

    const sayModal = new ModalBuilder()
      .setCustomId("sayModal")
      .setTitle("Napisz coś poprzez bota");

    const sayQuestion = new TextInputBuilder()
      .setCustomId("sayMessage")
      .setLabel("Napisz coś")
      .setPlaceholder("Wpisz cokolwiek...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const sayEmbed = new TextInputBuilder()
      .setCustomId("embedMode")
      .setLabel("Tryb embed: (on/off)")
      .setPlaceholder("on/off")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const sayActionRow = new ActionRowBuilder().addComponents(sayQuestion);
    const embedActionRow = new ActionRowBuilder().addComponents(sayEmbed);

    sayModal.addComponents(sayActionRow, embedActionRow);

    await interaction.showModal(sayModal);

    try {
      const response = await interaction.awaitModalSubmit({ time: 300000 });

      const message = response.fields.getTextInputValue("sayMessage");
      const embedSay = response.fields.getTextInputValue("embedMode");

      const embed = createBaseEmbed({ description: message });

      if (embedSay && embedSay.toLowerCase() === "on") {
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }

      await response.reply({
        content: "Twoja wiadomość została wysłana",
        ephemeral: true,
      });
    } catch (error) {
      logger.error(`Błąd podczas wysyłania wiadomości w /say: ${error}`);
      await interaction.editReply({
        content: "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
        ephemeral: true,
      });
    }
  },
};
