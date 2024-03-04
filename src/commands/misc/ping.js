module.exports = {
  data: {
    name: "ping",
    description: "Pong!",
  },
  
  run: async ({ interaction, client, handler }) => {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply(
      `Pong! Client ${ping}ms | Websocket: ${client.ws.ping}ms`
    );
  },

  options: {
    devOnly: true,
  },
};
