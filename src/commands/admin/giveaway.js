const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require("discord.js");
const { randomUUID } = require("crypto");
const ms = require("ms");
const Giveaway = require("../../models/Giveaway");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");
const pickWinners = require("../../utils/pickWinners");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("System giveaway - zarządzanie giveawayami")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Tworzy nowy giveaway")
        .addStringOption((option) =>
          option
            .setName("prize")
            .setDescription("Nagroda giveawayu")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Treść giveawayu")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setDescription("Liczba wygranych")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Czas trwania giveawayu (np. 1h, 30m, 1d)")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("pingrole")
            .setDescription("Rola do pingowania (opcjonalnie)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edytuje istniejący giveaway")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID giveawayu do edycji")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("prize")
            .setDescription("Nowa nagroda giveawayu")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Nowa treść giveawayu")
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setDescription("Nowa liczba wygranych")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Nowy czas trwania giveawayu (np. 1h, 30m, 1d)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("pingrole")
            .setDescription("Nowa rola do pingowania (opcjonalnie)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Usuwa istniejący giveaway")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID giveawayu do usunięcia")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("Kończy działający giveaway (bez losowania zwycięzców)")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID giveawayu do zakończenia")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("Wyświetla listę aktywnych giveawayów")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setDescription("Losuje nowych zwycięzców dla zakończonego giveawayu")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID giveawayu do rerollu")
            .setRequired(true)
        )
    ),

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();

    const getTimestamp = (date) => Math.floor(date.getTime() / 1000);

    if (subcommand === "create") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const prize = interaction.options.getString("prize");
        const description = interaction.options.getString("description");
        const winnersCount = interaction.options.getInteger("winners");
        const durationStr = interaction.options.getString("duration");
        const pingRole = interaction.options.getRole("pingrole");
    
        const durationMs = ms(durationStr);
        if (!durationMs || durationMs <= 0) {
          return interaction.editReply("Podaj poprawny czas trwania giveawayu (np. 1h, 30m, 1d).");
        }
        const endTime = new Date(Date.now() + durationMs);
        const timestamp = getTimestamp(endTime);
        const giveawayId = randomUUID();
    
        const embed = createBaseEmbed({
          description: `### ${prize}\n${description}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${interaction.user.id}>\n**Zwycięzcy:** ${winnersCount}`,
          footerText: `Giveaway ID: ${giveawayId}`,
          color: "#5865F2",
        });
    
        const joinButton = new ButtonBuilder()
          .setCustomId(`giveaway_join_${giveawayId}`)
          .setLabel("🎉 Dołącz")
          .setStyle(ButtonStyle.Primary);
        const countButton = new ButtonBuilder()
          .setCustomId(`giveaway_count_${giveawayId}`)
          .setLabel("Uczestników: 0")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);
        const row = new ActionRowBuilder().addComponents(joinButton, countButton);
    
        const content = `${pingRole ? `<@&${pingRole.id}>\n` : ""}### 🎉 🎉 Giveaway 🎉 🎉`;
    
        const giveawayMessage = await interaction.channel.send({
          content,
          embeds: [embed],
          components: [row],
        });
    
        const giveawayData = {
          giveawayId,
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          messageId: giveawayMessage.id,
          prize,
          description,
          winnersCount,
          endTime,
          pingRoleId: pingRole ? pingRole.id : undefined,
          active: true,
          participants: [],
          hostId: interaction.user.id,
        };
    
        await Giveaway.create(giveawayData);
        await interaction.editReply("Giveaway został pomyślnie utworzony!");
      } catch (error) {
        logger.error(`Błąd podczas tworzenia giveawayu: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas tworzenia giveawayu. Spróbuj ponownie później.");
      }
    } else if (subcommand === "edit") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const giveawayId = interaction.options.getString("id");
        const newPrize = interaction.options.getString("prize");
        const newDescription = interaction.options.getString("description");
        const newWinners = interaction.options.getInteger("winners");
        const newDurationStr = interaction.options.getString("duration");
        const newPingRole = interaction.options.getRole("pingrole");

        if (!newPrize && !newDescription && !newWinners && !newDurationStr && !newPingRole) {
          return interaction.editReply("Nie podałeś żadnych wartości do edycji giveawayu.");
        }

        const giveaway = await Giveaway.findOne({
          giveawayId,
          guildId: interaction.guild.id,
        });
        if (!giveaway) {
          return interaction.editReply("Giveaway o podanym ID nie został znaleziony.");
        }

        if (newPrize) giveaway.prize = newPrize;
        if (newDescription) giveaway.description = newDescription;
        if (newWinners) giveaway.winnersCount = newWinners;
        if (newDurationStr) {
          const durationMs = ms(newDurationStr);
          if (!durationMs || durationMs <= 0) {
            return interaction.editReply("Podaj poprawny czas trwania giveawayu (np. 1h, 30m, 1d).");
          }
          giveaway.endTime = new Date(Date.now() + durationMs);
        }
        if (newPingRole) giveaway.pingRoleId = newPingRole.id;

        await giveaway.save();

        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
          return interaction.editReply("Nie znaleziono kanału, na którym był uruchomiony ten giveaway.");
        }
        let giveawayMessage;
        try {
          giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (err) {
          logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err.message}`);
        }
        const timestamp = getTimestamp(giveaway.endTime);
        const updatedEmbed = createBaseEmbed({
          title: "🎉 Giveaway!",
          description: `**Nagroda:** ${giveaway.prize}\n${giveaway.description}\n**Liczba wygranych:** ${giveaway.winnersCount}\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${giveaway.hostId}>`,
          footerText: `Giveaway ID: ${giveaway.giveawayId}`,
          color: "#2B2D31",
        });
      
        if (giveawayMessage) {
          await giveawayMessage.edit({ embeds: [updatedEmbed] });
        }
      
        await interaction.editReply("Giveaway został pomyślnie zaktualizowany!");
      } catch (error) {
        logger.error(`Błąd podczas edycji giveawayu: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas edycji giveawayu. Spróbuj ponownie później.");
      }
    } else if (subcommand === "delete") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const giveawayId = interaction.options.getString("id");
        const giveaway = await Giveaway.findOne({
          giveawayId,
          guildId: interaction.guild.id,
        });
        if (!giveaway) {
          return interaction.editReply("Giveaway o podanym ID nie został znaleziony.");
        }
  
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (channel) {
          try {
            const message = await channel.messages.fetch(giveaway.messageId);
            if (message) {
              await message.delete();
            }
          } catch (err) {
            logger.warn(`Nie udało się usunąć wiadomości giveawayu (ID: ${giveaway.messageId}): ${err.message}`);
          }
        } else {
          logger.warn(`Kanał o ID ${giveaway.channelId} nie został znaleziony.`);
        }
  
        await Giveaway.deleteOne({ giveawayId, guildId: interaction.guild.id });
        await interaction.editReply("Giveaway został pomyślnie usunięty.");
      } catch (error) {
        logger.error(`Błąd podczas usuwania giveawayu: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas usuwania giveawayu. Spróbuj ponownie później.");
      }
    } else if (subcommand === "end") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const giveawayId = interaction.options.getString("id");
        const giveaway = await Giveaway.findOne({
          giveawayId,
          guildId: interaction.guild.id,
        });
        if (!giveaway) {
          return interaction.editReply("Giveaway o podanym ID nie został znaleziony.");
        }
        if (!giveaway.active) {
          return interaction.editReply("Ten giveaway został już zakończony.");
        }
        giveaway.active = false;
        await giveaway.save();
    
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
          return interaction.editReply("Nie znaleziono kanału, na którym został uruchomiony ten giveaway.");
        }
        let giveawayMessage;
        try {
          giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (err) {
          logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err.message}`);
          return interaction.editReply("Nie udało się pobrać wiadomości giveawayu.");
        }
    
        const winners = await pickWinners(giveaway.participants, giveaway.winnersCount, interaction.guild);
        const winnersText = winners.length ? winners.map((user) => `<@${user.id}>`).join(", ") : "";
        const participantsCount = giveaway.participants.length;
        const timestamp = getTimestamp(giveaway.endTime);
    
        const updatedEmbed = createBaseEmbed({
          description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantsCount}\n**Zwycięzcy:** ${winnersText}`,
          footerText: `Giveaway ID: ${giveaway.giveawayId}`,
          color: "#2B2D31",
        });
    
        await giveawayMessage.edit({
          content: "### 🎉 🎉 Giveaway 🎉 🎉",
          embeds: [updatedEmbed],
          components: [],
        });
        logger.info(`Giveaway ${giveaway.giveawayId} został automatycznie zakończony.`);
    
        if (winners.length > 0) {
          await giveawayMessage.reply({
            content: `Gratulacje ${winners.map((user) => `<@${user.id}>`).join(", ")}! **${giveaway.prize}** jest Twoje!`
          });
        } else {
          await giveawayMessage.reply({
            content: "Brak zgłoszeń, więc nie udało się wyłonić zwycięzcy!"
          });
        }
      
        await interaction.editReply("Giveaway został zakończony.");
      } catch (error) {
        logger.error(`Błąd podczas kończenia giveawayu: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas kończenia giveawayu. Spróbuj ponownie później.");
      }
    } else if (subcommand === "list") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const giveaways = await Giveaway.find({
          guildId: interaction.guild.id,
          active: true,
        });
        if (!giveaways || giveaways.length === 0) {
          return interaction.editReply("Brak aktywnych giveawayów na tym serwerze.");
        }
        giveaways.sort((a, b) => a.endTime - b.endTime);
        const description = giveaways
          .map((g) => {
            const timestamp = getTimestamp(g.endTime);
            return `**ID:** ${g.giveawayId}\n**Nagroda:** ${g.prize}\n**Liczba wygranych:** ${g.winnersCount}\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)`;
          })
          .join("\n\n");
        const embed = createBaseEmbed({
          title: "🎉 Aktywne Giveawayy",
          description,
          color: "#5865F2",
          footerText: `Łącznie: ${giveaways.length} giveawayów`,
        });
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error(`Błąd podczas wyświetlania listy giveawayów: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas wyświetlania listy giveawayów. Spróbuj ponownie później.");
      }
    } else if (subcommand === "reroll") {
      try {
        await interaction.deferReply({ ephemeral: true });
        const giveawayId = interaction.options.getString("id");
        const giveaway = await Giveaway.findOne({
          giveawayId,
          guildId: interaction.guild.id,
        });
        if (!giveaway) {
          return interaction.editReply("Giveaway o podanym ID nie został znaleziony.");
        }
        if (giveaway.active) {
          return interaction.editReply("Giveaway musi być zakończony, aby móc wykonać reroll.");
        }
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
          return interaction.editReply("Nie znaleziono kanału, na którym został uruchomiony ten giveaway.");
        }
        let giveawayMessage;
        try {
          giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (err) {
          logger.warn(`Nie udało się pobrać wiadomości giveaway: ${err.message}`);
          return interaction.editReply("Nie można pobrać wiadomości giveawayu.");
        }
        if (!giveawayMessage) {
          return interaction.editReply("Nie można pobrać wiadomości giveawayu.");
        }
        const participantArray = giveaway.participants;
        if (participantArray.length === 0) {
          return interaction.editReply("Brak uczestników giveawayu.");
        }
        const winners = await pickWinners(participantArray, giveaway.winnersCount, interaction.guild);
        const winnersText = winners.length ? winners.map((user) => `<@${user.id}>`).join(", ") : "";
        const timestamp = getTimestamp(giveaway.endTime);
    
        const updatedEmbed = createBaseEmbed({
          description: `### ${giveaway.prize}\n${giveaway.description}\n\n**Koniec:** <t:${timestamp}:R> (<t:${timestamp}:f>)\n**Host:** <@${giveaway.hostId}>\n**Uczestnicy:** ${participantArray.length}\n**Zwycięzcy:** ${winnersText}`,
          footerText: `Giveaway ID: ${giveaway.giveawayId}`,
          color: "#2B2D31",
        });
    
        await giveawayMessage.edit({
          content: "### 🎉 🎉 Giveaway 🎉 🎉",
          embeds: [updatedEmbed],
          components: [],
        });
    
        if (winners.length > 0) {
          await giveawayMessage.reply({
            content: `Gratulacje ${winners.map((user) => `<@${user.id}>`).join(", ")}! **${giveaway.prize}** jest Twoje!`
          });
        } else {
          await giveawayMessage.reply({
            content: "Brak zgłoszeń, więc nie udało się wyłonić zwycięzcy!"
          });
        }
        
        await interaction.editReply("Nowi zwycięzcy zostali wyłonieni!");
      } catch (error) {
        logger.error(`Błąd podczas rerollu giveawayu: ${error}`);
        await interaction.editReply("Wystąpił błąd podczas rerollu giveawayu. Spróbuj ponownie później.");
      }
    }      
  },
};

function getTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}
