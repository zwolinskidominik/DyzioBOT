const {
  AttachmentBuilder,
  ApplicationCommandOptionType,
} = require("discord.js");
const { Font } = require("canvacord");
const { WarnCard } = require("../../utils/WarnCard");

module.exports = {
  data: {
    name: "warn",
    description: "Ostrzega użytkownika o nieprawidłowym zachowaniu.",
    options: [
      {
        name: "target-user",
        description: "Użytkownik, któremu chcesz nadać upomnienie.",
        required: true,
        type: ApplicationCommandOptionType.User,
      },
      {
        name: "reason",
        description: "Powód upomnienia.",
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const targetUserId = interaction.options.get("target-user").value;

    await interaction.deferReply();

    const user = await interaction.guild.members.fetch(targetUserId);

    if (!user) {
      await interaction.editReply({
        content: "Nie znaleziono użytkownika.",
        ephemeral: true,
      });
      return;
    }

    const reason = interaction.options.get("reason")?.value || "Brak";

    try {
      const avatar = user.user.displayAvatarURL({ format: "png" });

      await Font.loadDefault();

      const card = new WarnCard()
        .setAvatar(avatar)
        .setDisplayName(user.user.tag)
        .setMessage(`Został nadany 1 punkt ostrzeżeń`)
        .setReason(`${reason}`)
        .setAuthor(interaction.user.tag);

      const image = await card.build({ format: "png" });

      const attachment = new AttachmentBuilder(image, { name: "warn.png" });

      await interaction.editReply({ files: [attachment] });
    } catch (error) {
      console.error("Błąd podczas generowania ostrzeżenia:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas generowania ostrzeżenia.",
        ephemeral: true,
      });
    }
  },

  options: {
    userPermissions: ["Administrator"],
    botPermissions: ["BanMembers"],
  },
};
