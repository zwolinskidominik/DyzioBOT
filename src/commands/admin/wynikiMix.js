const { SlashCommandBuilder } = require("discord.js");
const Clip = require("../../models/Clip");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

const JURY_ROLE_ID = "1303735601845239969";
const OWNER_ROLE_ID = "881295973782007868";
const SEPARATOR_GIF_URL =
  "https://64.media.tumblr.com/64084f352d1664758e1a4febcb0e4464/8ac72bb49761ea20-51/s500x750/0646a52b0686cac841fd1201edde418ccddf6443.gif";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wyniki-mix")
    .setDescription("Wyświetla wyniki coponiedziałkowych mixów CS2")
    .setDMPermission(false),

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();

      if (!interaction.member.roles.cache.has(JURY_ROLE_ID || OWNER_ROLE_ID)) {
        return await interaction.editReply({
          content: "Nie masz uprawnień do wyświetlania wyników!",
          ephemeral: true,
        });
      }

      const clips = await Clip.find();

      if (clips.length === 0) {
        return await interaction.editReply({
          content: "Nie znaleziono żadnych zgłoszonych klipów!",
          ephemeral: true,
        });
      }

      const juryMembers =
        interaction.guild.roles.cache.get(JURY_ROLE_ID).members;
      const juryIds = Array.from(juryMembers.keys());

      const allVoted = clips.every((clip) =>
        juryIds.every((juryId) =>
          clip.votes.some((vote) => vote.juryId === juryId)
        )
      );

      if (!allVoted) {
        return await interaction.editReply({
          content:
            "Nie wszyscy członkowie jury oddali swoje głosy na wszystkie klipy!",
          ephemeral: true,
        });
      }

      const results = clips.map((clip) => ({
        clip,
        averageScore: clip.getAverageScore(),
      }));

      results.sort((a, b) => b.averageScore - a.averageScore);

      const topWinners = results.slice(0, 3);
      const remainingClips = results.slice(3);
      const luckyLoser =
        remainingClips.length > 0
          ? remainingClips[Math.floor(Math.random() * remainingClips.length)]
          : null;

      await interaction.followUp({ files: [SEPARATOR_GIF_URL] });

      const resultsEmbed = createBaseEmbed({
        title: "🏆 Wyniki coponiedziałkowych mixów CS2",
        color: "#7c000c",
      });

      topWinners.forEach((result, index) => {
        resultsEmbed.addFields({
          name: `#${index + 1} Miejsce`,
          value: `<@!${
            result.clip.authorId
          }> - Średnia ocena: ${result.averageScore.toFixed(
            2
          )} - [Link do klipu](${result.clip.messageLink})`,
        });
      });

      if (luckyLoser) {
        resultsEmbed.addFields({
          name: "🎲 Lucky Loser",
          value: `<@!${
            luckyLoser.clip.authorId
          }> - Średnia ocena: ${luckyLoser.averageScore.toFixed(
            2
          )} - [Link do klipu](${luckyLoser.clip.messageLink})`,
        });
      }

      await interaction.editReply({ embeds: [resultsEmbed] });

      await interaction.channel.send({ files: [SEPARATOR_GIF_URL] });

      await Clip.clearAll();
    } catch (error) {
      logger.error(`Błąd podczas wykonywania komendy /wyniki-mix: ${error}`);
      await interaction.editReply({
        content: "Wystąpił błąd podczas wykonywania komendy.",
        ephemeral: true,
      });
    }
  },
};
