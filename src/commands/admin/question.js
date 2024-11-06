const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require("discord.js");
const Question = require("../../models/Question");

const isValidEmoji = (reaction) => {
  const emojiRegex = /^(\p{Emoji}|\p{Emoji_Component})+$/u;
  const discordEmojiRegex = /^<a?:[a-zA-Z0-9_]+:[0-9]+>$/;
  return emojiRegex.test(reaction) || discordEmojiRegex.test(reaction);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Zarządzaj pytaniami dnia")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Wyświetl listę pytań w bazie danych")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaj nowe pytanie")
        .addStringOption((option) =>
          option
            .setName("content")
            .setDescription("Treść pytania")
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption((option) =>
          option
            .setName("reactions")
            .setDescription("Reakcje na pytanie (oddzielone spacją)")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Usuń pytanie o danym numerze")
        .addIntegerOption((option) =>
          option
            .setName("number")
            .setDescription("Numer pytania do usunięcia")
            .setRequired(true)
        )
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      await interaction.deferReply({ ephemeral: true });

      const pageSize = 5;
      let currentPage = 1;

      const generateEmbed = async (page) => {
        const skip = (page - 1) * pageSize;
        const totalQuestions = await Question.countDocuments();
        const totalPages = Math.ceil(totalQuestions / pageSize);

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
                  `${skip + index + 1}. ${
                    q.content
                  }\nReakcje: ${q.reactions.join(" ")}`
              )
              .join("\n\n")
          )
          .setFooter({
            text: `Strona ${page} z ${totalPages} | Łączna liczba pytań: ${totalQuestions}`,
          });

        return { embed, totalPages };
      };

      const generateButtons = (currentPage, totalPages) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("Poprzednia")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Następna")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
        );
      };

      const { embed, totalPages } = await generateEmbed(currentPage);
      const buttonRow = generateButtons(currentPage, totalPages);

      const reply = await interaction.editReply({
        embeds: [embed],
        components: [buttonRow],
        ephemeral: true,
      });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "Nie możesz używać tych przycisków.",
            ephemeral: true,
          });
        }

        await i.deferUpdate();

        if (i.customId === "prev" && currentPage > 1) {
          currentPage--;
        } else if (i.customId === "next" && currentPage < totalPages) {
          currentPage++;
        }

        const { embed: newEmbed, totalPages: newTotalPages } =
          await generateEmbed(currentPage);
        const newButtonRow = generateButtons(currentPage, newTotalPages);

        try {
          await i.editReply({
            embeds: [newEmbed],
            components: [newButtonRow],
          });
        } catch (error) {
          if (error.code === 10008) {
            return;
          } else {
            console.error("Błąd podczas aktualizacji wiadomości:", error);
          }
        }
      });

      collector.on("end", async () => {
        try {
          const message = await interaction.channel.messages
            .fetch(reply.id)
            .catch(() => null);
          if (!message) return;

          const disabledButtonRow = new ActionRowBuilder().addComponents(
            buttonRow.components[0].setDisabled(true),
            buttonRow.components[1].setDisabled(true)
          );
          await reply.edit({ components: [disabledButtonRow] });
        } catch (error) {
          return;
        }
      });
    } else if (subcommand === "add") {
      const errorEmbed = new EmbedBuilder().setColor("#FF0000");
      const successEmbed = new EmbedBuilder().setColor("#00BFFF");

      const question = interaction.options.getString("content").trim();
      const reactionsInput = interaction.options.getString("reactions").trim();

      if (question.length < 5) {
        return await interaction.reply({
          embeds: [
            errorEmbed.setDescription(
              "Pytanie musi mieć co najmniej 5 znaków."
            ),
          ],
          ephemeral: true,
        });
      }

      const reactions = reactionsInput.split(/\s+/).filter(Boolean);
      if (reactions.length < 2 || reactions.length > 5) {
        return await interaction.reply({
          embeds: [
            errorEmbed.setDescription("Musisz podać od 2 do 5 reakcji."),
          ],
          ephemeral: true,
        });
      }

      const invalidReactions = reactions.filter(
        (reaction) => !isValidEmoji(reaction)
      );
      if (invalidReactions.length > 0) {
        return await interaction.reply({
          embeds: [
            errorEmbed.setDescription(
              `Następujące reakcje są nieprawidłowe: ${invalidReactions.join(
                ", "
              )}`
            ),
          ],
          ephemeral: true,
        });
      }

      try {
        const questionModel = new Question({
          authorId: interaction.user.id,
          content: question,
          reactions,
        });

        await questionModel.save();

        await interaction.reply({
          embeds: [
            successEmbed.setDescription("Pomyślnie dodano pytanie dnia!"),
          ],
          ephemeral: true,
        });
      } catch (error) {
        console.error(`Błąd podczas dodawania pytania: ${error}`);
        await interaction.reply({
          embeds: [
            errorEmbed.setDescription(
              `Wystąpił błąd podczas dodawania pytania: ${error.message}`
            ),
          ],
          ephemeral: true,
        });
      }
    } else if (subcommand === "remove") {
      const questionNumber = interaction.options.getInteger("number");

      const totalQuestions = await Question.countDocuments();
      if (questionNumber < 1 || questionNumber > totalQuestions) {
        return await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription(
                `Nieprawidłowy numer pytania. Wprowadź numer od 1 do ${totalQuestions}.`
              ),
          ],
          ephemeral: true,
        });
      }

      try {
        const questionToDelete = await Question.findOne()
          .sort({ _id: 1 })
          .skip(questionNumber - 1);

        if (!questionToDelete) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("Nie znaleziono pytania o podanym numerze."),
            ],
            ephemeral: true,
          });
        }

        await Question.deleteOne({ _id: questionToDelete._id });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#00BFFF")
              .setDescription(
                `Pytanie nr ${questionNumber} zostało pomyślnie usunięte.`
              ),
          ],
          ephemeral: true,
        });
      } catch (error) {
        console.error(`Błąd podczas usuwania pytania: ${error}`);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription(
                `Wystąpił błąd podczas usuwania pytania: ${error.message}`
              ),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
