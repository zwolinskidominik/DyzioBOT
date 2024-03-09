module.exports = {
  data: {
    name: 'ping',
    description: 'Pong!',
  },
  
  run: async ({ interaction, client }) => {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply(
      `Pong! Klient ${ping}ms | Websocket: ${client.ws.ping}ms`
    );
  },
};
