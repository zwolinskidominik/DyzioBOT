const {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { Font } = require("canvacord");
const { WarnCard } = require("../../utils/WarnCard");
const Warn = require("../../models/Warn");

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
        .setRequired(false)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
  },

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const robotoLight = await Font.fromFile("src/assets/Roboto-Light.ttf");
    const robotoRegular = await Font.fromFile("src/assets/Roboto-Regular.ttf");
    const robotoMedium = await Font.fromFile("src/assets/Roboto-Medium.ttf");

    const targetUserId = interaction.options.getUser("target-user").id;
    const reason = interaction.options.getString("reason") || "Brak";
    const guildId = interaction.guild.id;

    const user = await interaction.guild.members.fetch(targetUserId);

    if (!user) {
      await interaction.editReply({
        content: "Nie znaleziono użytkownika.",
        ephemeral: true,
      });
      return;
    }

    const targetUserRolePosition = user.roles.highest.position;
    const requestUserRolePosition = interaction.member.roles.highest.position;
    const botRolePosition = interaction.guild.members.me.roles.highest.position;

    if (
      targetUserRolePosition >= requestUserRolePosition ||
      targetUserRolePosition >= botRolePosition
    ) {
      await interaction.editReply({
        content:
          "Nie możesz nadać ostrzeżenia użytkownikowi z wyższą lub równą rolą.",
        ephemeral: true,
      });
      return;
    }

    try {
      const avatar = user.user.displayAvatarURL({ format: "png" });

      let warn = await Warn.findOne({ userId: targetUserId, guildId });
      if (!warn) {
        warn = new Warn({
          userId: targetUserId,
          guildId,
          count: 0,
          warnings: [],
        });
      }

      warn.count += 1;

      let muteDuration;
      let muteReason;
      let kickUser = false;

      if (warn.count === 1) {
        muteDuration = 3600 * 1000;
        muteReason = "1 ostrzeżenie - czasowe wyciszenie na 1 godzinę.";
      } else if (warn.count === 2) {
        muteDuration = 86400 * 1000;
        muteReason = "2 ostrzeżenie - czasowe wyciszenie na 1 dzień.";
      } else if (warn.count === 3) {
        muteDuration = 259200 * 1000;
        muteReason = "3 ostrzeżenie - czasowe wyciszenie na 3 dni.";
      } else if (warn.count === 4) {
        muteDuration = 604800 * 1000;
        muteReason = "4 ostrzeżenie - czasowe wyciszenie na 7 dni.";
      } else if (warn.count >= 5) {
        kickUser = true;
        muteReason = "5 ostrzeżenie - wyrzucenie z serwera.";
      }

      warn.warnings.push({
        reason,
        date: new Date(),
        moderator: interaction.user.tag,
      });

      const card = new WarnCard()
        .setAvatar(avatar)
        .setDisplayName(user.user.tag)
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

      if (kickUser) {
        await user.kick(muteReason);
      } else {
        await user.timeout(muteDuration, muteReason);
      }

      await warn.save();

      await interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      console.error("Błąd podczas generowania ostrzeżenia:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas generowania ostrzeżenia.",
        ephemeral: true,
      });
    }
  },
};
