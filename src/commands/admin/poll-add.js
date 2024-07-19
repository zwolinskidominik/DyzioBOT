const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Poll = require("../../models/Poll");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll-add")
    .setDescription("Dodaj pytanie.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Treść pytania.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("answer1")
        .setDescription("Pierwsza odpowiedź.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("emoji1")
        .setDescription("Emoji dla pierwszej odpowiedzi.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("answer2")
        .setDescription("Druga odpowiedź.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("emoji2")
        .setDescription("Emoji dla drugiej odpowiedzi.")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("allowmultiselect")
        .setDescription("Czy pozwolić na wielokrotny wybór.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("answer3")
        .setDescription("Trzecia odpowiedź.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("emoji3")
        .setDescription("Emoji dla trzeciej odpowiedzi.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("answer4")
        .setDescription("Czwarta odpowiedź.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("emoji4")
        .setDescription("Emoji dla czwartej odpowiedzi.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("answer5")
        .setDescription("Piąta odpowiedź.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("emoji5")
        .setDescription("Emoji dla piątej odpowiedzi.")
        .setRequired(false)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const question = interaction.options.getString("question");
    const answers = [
      interaction.options.getString("answer1"),
      interaction.options.getString("answer2"),
      interaction.options.getString("answer3"),
      interaction.options.getString("answer4"),
      interaction.options.getString("answer5"),
    ].filter(Boolean);
    const emojis = [
      interaction.options.getString("emoji1"),
      interaction.options.getString("emoji2"),
      interaction.options.getString("emoji3"),
      interaction.options.getString("emoji4"),
      interaction.options.getString("emoji5"),
    ].filter(Boolean);
    const allowMultiselect = interaction.options.getBoolean("allowmultiselect");

    try {
      const poll = new Poll({
        authorId: interaction.user.id,
        content: question,
        answers: answers.map((answer, index) => ({
          text: answer,
          emoji: emojis[index],
        })),
        allowMultiselect,
      });

      await poll.save();

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
