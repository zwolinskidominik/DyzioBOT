const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const checkRole = require("../../utils/checkRole");
const { Font } = require("canvacord");
const { WarnCard } = require("../../utils/WarnCard");
const Warn = require("../../models/Warn");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Ostrzega użytkownika o nieprawidłowym zachowaniu.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, któremu chcesz nadać upomnienie.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Powód upomnienia.")
        .setRequired(true)
    ),
  options: {
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
  },
  run: async ({ interaction }) => {
    await interaction.deferReply();

    const robotoLight = await Font.fromFile("assets/Roboto-Light.ttf");
    const robotoRegular = await Font.fromFile("assets/Roboto-Regular.ttf");
    const robotoMedium = await Font.fromFile("assets/Roboto-Medium.ttf");

    const targetUserId = interaction.options.getUser("target-user").id;
    const reason = interaction.options.getString("reason") || "Brak";
    const guildId = interaction.guild.id;

    const targetMember = await interaction.guild.members.fetch(targetUserId);
    if (!targetMember) {
      await interaction.editReply({
        content: "Nie znaleziono użytkownika.",
        ephemeral: true,
      });
      return;
    }

    if (!checkRole(targetMember, interaction.member, interaction.guild.members.me)) {
      await interaction.editReply({
        content:
          "Nie możesz nadać ostrzeżenia użytkownikowi z wyższą lub równą rolą.",
        ephemeral: true,
      });
      return;
    }

    try {
      const avatar = targetMember.user.displayAvatarURL({ format: "png" });
      let warnRecord = await Warn.findOne({ userId: targetUserId, guildId });
      if (!warnRecord) {
        warnRecord = new Warn({
          userId: targetUserId,
          guildId,
          count: 0,
          warnings: [],
        });
      }

      warnRecord.count += 1;

      let muteDuration;
      let muteReason;
      let banUser = false;

      if (warnRecord.count === 1) {
        muteDuration = 3600 * 1000;
        muteReason = "1 ostrzeżenie - czasowe wyciszenie na 1 godzinę.";
      } else if (warnRecord.count === 2) {
        muteDuration = 3 * 3600 * 1000;
        muteReason = "2 ostrzeżenie - czasowe wyciszenie na 3 godziny.";
      } else if (warnRecord.count === 3) {
        muteDuration = 24 * 3600 * 1000;
        muteReason = "3 ostrzeżenie - czasowe wyciszenie na 1 dzień.";
      } else if (warnRecord.count === 4) {
        muteDuration = 7 * 24 * 3600 * 1000;
        muteReason = "4 ostrzeżenie - czasowe wyciszenie na 7 dni.";
      } else if (warnRecord.count >= 5) {
        banUser = true;
        muteReason = "5 ostrzeżenie - tymczasowy ban na serwerze na 1 miesiąc.";
      }

      warnRecord.warnings.push({
        reason,
        date: new Date(),
        moderator: interaction.user.tag,
      });

      const card = new WarnCard()
        .setAvatar(avatar)
        .setDisplayName(targetMember.user.tag)
        .setMessage(`Został nadany 1 punkt ostrzeżeń`)
        .setReason(reason)
        .setMuteReason(muteReason)
        .setAuthor(interaction.user.tag)
        .setDisplayNameFont(robotoRegular)
        .setMessageFont(robotoMedium)
        .setReasonFont(robotoLight)
        .setAuthorFont(robotoMedium);

      const image = await card.build({ format: "png" });
      const attachment = new AttachmentBuilder(image, { name: "warn.png" });

      if (banUser) {
        const unbanDate = new Date();
        unbanDate.setMonth(unbanDate.getMonth() + 1);
        warnRecord.banUntil = unbanDate;

        const embed = createBaseEmbed({
          isError: true,
          title: "Tymczasowy ban na serwerze",
          description: `Zostałeś/aś tymczasowo zbanowany/a na okres 1 miesiąca.
          
          Powód: ${muteReason}
          
          Ban wygasa: ${unbanDate.toLocaleString()}`,
        });

        try {
          await targetMember.send({ embeds: [embed] });
        } catch (error) {
          logger.error(
            `Nie można wysłać wiadomości do użytkownika ${targetMember.user.tag}:`,
            error
          );
          await interaction.followUp({
            content: `Nie udało się wysłać prywatnej wiadomości do ${targetMember.user.tag}. Użytkownik może mieć wyłączone wiadomości prywatne.`,
            ephemeral: true,
          });
        }

        await targetMember.ban({ reason: muteReason });
      } else {
        await targetMember.timeout(muteDuration, muteReason);
      }

      await warnRecord.save();

      await interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      logger.error("Błąd podczas generowania ostrzeżenia:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas generowania ostrzeżenia.",
        ephemeral: true,
      });
    }
  },
};
