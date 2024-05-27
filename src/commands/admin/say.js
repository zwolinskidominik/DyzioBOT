const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: {
    name: "say",
    description: "Napisz coś za pomocą bota.",
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
      .setLabel("Tryb embed on/off?")
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

      const embed = new EmbedBuilder().setDescription(message).setColor('#00BFFF');

      if (embedSay && (embedSay.toLowerCase() === "on")) {
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }

      await response.reply({
        content: "Twoja wiadomość została wysłana",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Błąd podczas wysyłania wiadomości:", error);
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await interaction.followUp({
          content: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
          ephemeral: true,
        });
      }
    }
  },

  options: {
    userPermissions: ["ModerateMembers"],
    botPermissions: ["ModerateMembers"],
  },
};
