const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),

  run: async ({ interaction, client }) => {
    try {
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      const ping = reply.createdTimestamp - interaction.createdTimestamp;
      const websocketPing = client.ws.ping;

      const embed = createBaseEmbed({
        title: "🏓 Pong!",
        description: `**Klient:** ${ping}ms\n**Websocket:** ${websocketPing}ms`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Błąd podczas wykonywania komendy /ping: ${error}`);
      const errorEmbed = createBaseEmbed({
        isError: true,
        description: "Wystąpił błąd podczas wykonywania komendy.",
      });
      await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
