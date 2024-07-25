const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Warn = require("../../models/Warn");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Sprawdza liczbę ostrzeżeń użytkownika.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(
          "Użytkownik, którego liczba ostrzeżeń ma zostać sprawdzona."
        )
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    const userId =
      interaction.options.getUser("user")?.id || interaction.user.id;
    const guildId = interaction.guild.id;

    if (
      userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)
    ) {
      await interaction.reply({
        content:
          "Nie masz uprawnień do sprawdzania ostrzeżeń innych użytkowników.",
        ephemeral: true,
      });
      return;
    }

    const warn = await Warn.findOne({ userId, guildId });

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`Liczba ostrzeżeń: ${warn ? warn.count : 0}`)
      .setFooter({
        text: `Na życzenie ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    if (warn && warn.warnings.length > 0) {
      const warningList = warn.warnings
        .map(
          (w, index) =>
            `**⏱️ ${w.date.toLocaleString()}**\nID ostrzeżenia (**${
              index + 1
            }**) - Moderator: ${w.moderator}\n\`${w.reason}\``
        )
        .join("\n\n");

      embed.setDescription(warningList);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
