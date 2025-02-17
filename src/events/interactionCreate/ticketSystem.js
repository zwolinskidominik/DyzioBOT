const {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require("discord.js");
const path = require("path");
const TicketStats = require("../../models/TicketStats");
const TicketConfig = require("../../models/TicketConfig");
const { createBaseEmbed } = require("../../utils/embedUtils");

const ROLES = {
  owner: "881295973782007868",
  admin: "881295975036104766",
  mod: "1232441670193250425",
  partnership: "1290788899991584778",
};

function createAttachment(imageName) {
  return new AttachmentBuilder(
    path.join(__dirname, "..", "..", "..", "assets/tickets", imageName)
  );
}

const ticketTypes = {
  help: {
    title: "Dział pomocy",
    description: (user) =>
      `Witaj ${user}!

Potrzebujesz pomocy? Opisz dokładnie, z czym masz problem, a nasz zespół postara się pomóc jak najszybciej.

Prosimy o:
↪︎ Dokładny opis problemu
↪︎ Zrzuty ekranu (jeśli to możliwe)
↪︎ Informacje, kiedy problem wystąpił`,
    color: "#5865F2",
    image: "ticketBanner.png",
  },
  report: {
    title: "System zgłoszeń",
    description: (user) =>
      `Witaj ${user}!

Jeśli chcesz poinformować o naruszeniu regulaminu, prosimy o podanie w zgłoszeniu:
↪︎ Kogo dotyczy sprawa? (Podaj nick)
↪︎ Co się stało? (Opisz sytuację)
↪︎ Masz dowody? (Załącz zrzuty ekranu lub nagranie)
↪︎ Kiedy to się stało? (Podaj datę)`,
    color: "#ED4245",
    image: "ticketReport.png",
  },
  partnership: {
    title: "Dział partnerstw",
    description: (user) =>
      `Witaj ${user}!

Jeśli jesteś zainteresowany partnerstwem z naszym serwerem, wyślij swoją reklamę i poczekaj na odpowiedź.`,
    color: "#FEE75C",
    image: "ticketPartnership.png",
  },
  idea: {
    title: "Pomysły",
    description: (user) =>
      `Witaj ${user}!

Masz pomysł na ulepszenie serwera? Podziel się nim!`,
    color: "#57F287",
    image: "ticketIdea.png",
  },
};

const channelNames = {
  help: "pomoc",
  report: "zgloszenie",
  partnership: "partnerstwo",
  idea: "pomysl",
};

module.exports = async (interaction) => {
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket-menu"
  ) {
    const config = await TicketConfig.findOne({
      guildId: interaction.guild.id,
    });
    if (!config) {
      return interaction.reply({
        content:
          "Brak konfiguracji systemu ticketów. Użyj komendy /setup-ticket, aby ją skonfigurować.",
        ephemeral: true,
      });
    }

    const category = interaction.guild.channels.cache.get(config.categoryId);
    if (!category) {
      return interaction.reply({
        content:
          "Nie znaleziono kategorii, którą skonfigurowałeś. Skontaktuj się z administracją.",
        ephemeral: true,
      });
    }

    const channelName = `${
      channelNames[interaction.values[0]]
    }-${interaction.user.username.toLowerCase()}`;

    const ticketChannel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.owner,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.admin,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: ROLES.mod,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
      ],
    });

    const selectedType = ticketTypes[interaction.values[0]];
    const ticketImage = createAttachment(selectedType.image);

    const welcomeEmbed = createBaseEmbed({
      title: selectedType.title,
      description: selectedType.description(interaction.user),
      color: selectedType.color,
      thumbnail: interaction.guild.iconURL({ dynamic: true }),
      image: `attachment://${selectedType.image}`,
      footerText: `Ticket utworzony przez ${interaction.user.tag}`,
      footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
    }).setTimestamp();

    const staffPing =
      interaction.values[0] === "partnership"
        ? `||<@&${ROLES.partnership}>||`
        : `||<@&${ROLES.owner}> <@&${ROLES.admin}> <@&${ROLES.mod}>||`;

    await ticketChannel.send({
      content: staffPing,
      flags: ["SuppressEmbeds"],
    });

    await ticketChannel.send({
      embeds: [welcomeEmbed],
      files: [ticketImage],
    });

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("zajmij-zgloszenie")
        .setLabel("Zajmij zgłoszenie")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("zamknij-zgloszenie")
        .setLabel("Zamknij zgłoszenie")
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      components: [buttonRow],
    });

    await interaction.reply({
      content: `Stworzono zgłoszenie: 🎫 ${ticketChannel}`,
      ephemeral: true,
    });
  }

  if (interaction.isButton()) {
    switch (interaction.customId) {
      case "zajmij-zgloszenie": {
        const hasRole = interaction.member.roles.cache.some((role) =>
          Object.values(ROLES).includes(role.id)
        );

        if (!hasRole) {
          return interaction.reply({
            content: "Nie masz uprawnień do zajmowania zgłoszeń!",
            ephemeral: true,
          });
        }

        await TicketStats.findOneAndUpdate(
          { guildId: interaction.guild.id, userId: interaction.user.id },
          { $inc: { count: 1 } },
          { upsert: true, new: true }
        );

        await interaction.reply({
          content: `${interaction.user} zajął(ęła) się zgłoszeniem!`,
        });
        break;
      }

      case "zamknij-zgloszenie": {
        const hasRole = interaction.member.roles.cache.some((role) =>
          Object.values(ROLES).includes(role.id)
        );

        const channelName = interaction.channel.name;
        const ticketCreator = interaction.channel.members.find((member) =>
          channelName.endsWith(member.user.username.toLowerCase())
        );

        if (!hasRole && ticketCreator?.id !== interaction.user.id) {
          return interaction.reply({
            content: "Nie masz uprawnień do zamykania tego zgłoszenia!",
            ephemeral: true,
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("potwierdz-zamkniecie")
            .setLabel("Potwierdź zamknięcie")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("anuluj-zamkniecie")
            .setLabel("Anuluj")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: "Czy na pewno chcesz zamknąć to zgłoszenie?",
          components: [confirmRow],
          ephemeral: true,
        });
        break;
      }

      case "potwierdz-zamkniecie": {
        await interaction.reply({
          content: "Zgłoszenie zostanie zamknięte za 5 sekund...",
          ephemeral: true,
        });

        setTimeout(async () => {
          if (interaction.channel) {
            try {
              await interaction.channel.delete();
            } catch (error) {
              console.warn(
                `Nie udało się usunąć kanału ticketu: ${error.message}`
              );
            }
          } else {
            console.warn(
              "Kanał ticketu już nie istnieje, nie można go usunąć."
            );
          }
        }, 5000);
        break;
      }

      case "anuluj-zamkniecie": {
        await interaction.reply({
          content: "Anulowano zamykanie zgłoszenia.",
          ephemeral: true,
        });
        break;
      }
    }
  }
};
