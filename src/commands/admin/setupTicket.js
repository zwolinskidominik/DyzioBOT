const {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const path = require("path");
const { createBaseEmbed } = require("../../utils/embedUtils");
const TicketConfig = require("../../models/TicketConfig");

function createAttachment(imageName) {
  return new AttachmentBuilder(
    path.join(__dirname, "..", "..", "..", "assets/tickets", imageName)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("Ustawia system ticketów")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  run: async ({ interaction }) => {
    const setupImage = createAttachment("ticketBanner.png");

    const categoryId = interaction.channel.parentId;
    if (!categoryId) {
      return interaction.reply({
        content:
          "Ten kanał nie należy do żadnej kategorii. Skontaktuj się z administracją.",
        ephemeral: true,
      });
    }

    try {
      await TicketConfig.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { categoryId },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Błąd zapisu konfiguracji ticketów:", error);
    }

    const embed = createBaseEmbed({
      title: "Kontakt z Administracją",
      description:
        "Aby skontaktować się z wybranym działem administracji wybierz odpowiednią kategorię",
      color: "#5865F2",
      image: "attachment://ticketBanner.png",
      thumbnail: interaction.guild.iconURL({ dynamic: true }),
    }).setTimestamp();

    const row = new (require("discord.js").ActionRowBuilder)().addComponents(
      new (require("discord.js").StringSelectMenuBuilder)()
        .setCustomId("ticket-menu")
        .setPlaceholder("Wybierz odpowiednią kategorię")
        .addOptions([
          {
            label: "Pomoc",
            description: "Potrzebujesz pomocy? Wybierz tę opcję!",
            value: "help",
            emoji: "❓",
          },
          {
            label: "Zgłoszenie",
            description: "Chcesz coś zgłosić? Kliknij tutaj!",
            value: "report",
            emoji: "🎫",
          },
          {
            label: "Partnerstwa",
            description: "Zainteresowany partnerstwem? Wybierz tę opcję!",
            value: "partnership",
            emoji: "🤝",
          },
          {
            label: "Mam pomysł",
            description: "Masz pomysł na ulepszenie serwera? Podziel się nim!",
            value: "idea",
            emoji: "💡",
          },
        ])
    );

    await interaction.channel.send({
      embeds: [embed],
      components: [row],
      files: [setupImage],
    });

    await interaction.reply({
      content: "System ticketów został pomyślnie skonfigurowany!",
      ephemeral: true,
    });
  },
};
