const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const Question = require("../../models/Question");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question-list")
    .setDescription("Wyświetl listę pytań w bazie danych.")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Numer strony do wyświetlenia")
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const page = interaction.options.getInteger("page") || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    await interaction.deferReply({ ephemeral: true });

    try {
      const totalQuestions = await Question.countDocuments();
      const totalPages = Math.ceil(totalQuestions / pageSize);

      if (page > totalPages) {
        return await interaction.editReply({
          content: `Strona ${page} nie istnieje. Dostępne strony: 1-${totalPages}`,
          ephemeral: true,
        });
      }

      const questions = await Question.find()
        .sort({ _id: 1 })
        .skip(skip)
        .limit(pageSize);

      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle("Lista pytań")
        .setDescription(
          questions
            .map(
              (q, index) =>
                `${skip + index + 1}. ${q.content}\nReakcje: ${q.reactions.join(
                  " "
                )}`
            )
            .join("\n\n")
        )
        .setFooter({
          text: `Strona ${page} z ${totalPages} | Łączna liczba pytań: ${totalQuestions}`,
        });

      await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error("Błąd podczas wyświetlania listy pytań:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas wyświetlania listy pytań.",
        ephemeral: true,
      });
    }
  },
};
