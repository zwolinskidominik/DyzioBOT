const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Question = require("../../models/Question");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question-list")
    .setDescription("Wyświetla listę pytań dnia wraz z ich reakcjami."),

  run: async ({ interaction }) => {
    try {
      const questions = await Question.find();

      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle("Lista pytań dnia")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      if (questions.length === 0) {
        embed.setDescription("Nie dodano jeszcze żadnych pytań dnia.");
      } else {
        embed.setDescription(`**Liczba pytań dnia: ${questions.length}**\n\n`);

        questions.forEach((question, index) => {
          embed.addFields({
            name: `Pytanie ${index + 1}:`,
            value: `**Treść:** ${question.content}\n**Reakcje:** ${
              question.reactions.join(" ") || "Brak"
            }`,
          });
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(`Błąd podczas pobierania listy pytań: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription("Wystąpił błąd podczas wyświetlania listy pytań.")
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
