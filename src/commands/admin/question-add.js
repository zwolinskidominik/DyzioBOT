const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Question = require("../../models/Question");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question-add")
    .setDescription("Dodaj pytanie.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Treść pytania.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reactions")
        .setDescription("Reakcje na pytanie (oddzielone spacją).")
        .setRequired(true)
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const question = interaction.options.getString("question");
    const reactions = interaction.options.getString("reactions").split(" ");

    try {
      const questionModel = new Question({
        authorId: interaction.user.id,
        content: question,
        reactions,
      });

      await questionModel.save();

      await interaction.reply({
        embeds: [successEmbed.setDescription("Pomyślnie dodano pytanie dnia!")],
        ephemeral: true,
      });
    } catch (error) {
      console.error(`Błąd podczas dodawania pytania: ${error}`);
      await interaction.reply({
        embeds: [
          errorEmbed.setDescription("Wystąpił błąd podczas dodawania pytania."),
        ],
        ephemeral: true,
      });
    }
  },
};
