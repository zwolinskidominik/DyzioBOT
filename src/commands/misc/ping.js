module.exports = {
  data: {
    name: "ping",
    description: "Pong!",
  },

  run: async ({ interaction, client }) => {
    try {
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      const ping = reply.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(
        `🏓 Pong! Klient ${ping}ms | Websocket: ${client.ws.ping}ms`
      );
    } catch (error) {
      console.error("Błąd podczas wykonywania komendy ping:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas wykonywania komendy.",
        ephemeral: true,
      });
    }
  },
};
