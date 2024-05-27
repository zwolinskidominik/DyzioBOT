const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: {
    name: "say",
    description: "Napisz coś za pomocą bota.",
  },

  run: async ({ interaction }) => {
    let channel = interaction.channel;

    let sayModal = new ModalBuilder()
      .setCustomId("say")
      .setTitle("Napisz coś poprzez bota");

    let sayQuestion = new TextInputBuilder()
      .setCustomId("say")
      .setLabel("Napisz coś")
      .setPlaceholder("Wpisz cokolwiek...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    let sayEmbed = new TextInputBuilder()
      .setCustomId("embed")
      .setLabel("Tryb embed on/off?")
      .setPlaceholder("on/off")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    let say = new ActionRowBuilder().addComponents(sayQuestion);
    let sayemb = new ActionRowBuilder().addComponents(sayEmbed);

    sayModal.addComponents(say, sayemb);

    await interaction.showModal(sayModal);

    try {
      let response = await interaction.awaitModalSubmit({ time: 300000 });
      let message = response.fields.getTextInputValue("say");
      let embedSay = response.fields.getTextInputValue("embed");

      const embed = new EmbedBuilder().setDescription(message).setColor('#00BFFF');

      if (embedSay === "on" || embedSay === "On" || embedSay === "ON") {
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }

      await response.reply({
        content: "Twoja wiadomość została wysłana",
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      return;
    }
  },

  options: {
    userPermissions: ["ModerateMembers"],
    botPermissions: ["ModerateMembers"],
  },
};
