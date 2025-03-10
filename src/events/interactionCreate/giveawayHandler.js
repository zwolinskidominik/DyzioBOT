const Giveaway = require("../../models/Giveaway");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = async (interaction) => {
  if (!interaction.isButton() || !interaction.customId) return;

  try {
    const parts = interaction.customId.split("_");
    if (parts.length < 3) return;
    const type = parts[0];
    const action = parts[1];
    const giveawayId = parts.slice(2).join("_");

    if (type !== "giveaway") return;

    await interaction.deferReply({ ephemeral: true });

    const giveaway = await Giveaway.findOne({
      giveawayId,
      guildId: interaction.guild.id,
    });
    if (!giveaway) {
      await interaction.editReply("Giveaway nie został znaleziony.");
      return;
    }

    let updated = false;
    if (action === "join") {
      if (giveaway.participants.includes(interaction.user.id)) {
        const leaveButton = new ButtonBuilder()
          .setCustomId(`giveaway_leave_${giveawayId}`)
          .setLabel("Opuść giveaway")
          .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(leaveButton);
        await interaction.editReply({
          content: "Już dołączyłeś do giveawayu.",
          components: [row],
        });
        return;
      } else {
        giveaway.participants.push(interaction.user.id);
        updated = true;
        await interaction.editReply("Dołączyłeś do giveawayu!");
      }
    } else if (action === "leave") {
      if (!giveaway.participants.includes(interaction.user.id)) {
        await interaction.editReply({ content: "Nie jesteś zapisany do giveawayu.", ephemeral: true });
        return;
      } else {
        giveaway.participants = giveaway.participants.filter(
          (id) => id !== interaction.user.id
        );
        updated = true;
        await interaction.editReply("Opuściłeś giveaway.");
      }
    }

    if (updated) {
      const channel = interaction.guild.channels.cache.get(giveaway.channelId);
      if (!channel) return;
      let giveawayMessage;
      try {
        giveawayMessage = await channel.messages.fetch(giveaway.messageId);
      } catch (err) {
        logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err.message}`);
        return;
      }
      if (!giveawayMessage) return;

      const joinButton = new ButtonBuilder()
        .setCustomId(`giveaway_join_${giveawayId}`)
        .setLabel("🎉 Dołącz")
        .setStyle(ButtonStyle.Primary);
      const countButton = new ButtonBuilder()
        .setCustomId(`giveaway_count_${giveawayId}`)
        .setLabel(`Uczestników: ${giveaway.participants.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const row = new ActionRowBuilder().addComponents(joinButton, countButton);
      await giveawayMessage.edit({ components: [row] });
      await giveaway.save();
    }
  } catch (error) {
    logger.error(`Błąd podczas obsługi przycisku giveaway: ${error}`);
  }
};
