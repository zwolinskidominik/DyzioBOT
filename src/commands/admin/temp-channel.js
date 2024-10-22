const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temp-channel")
    .setDescription("Zarządza kanałami tymczasowymi.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał do nasłuchiwania.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "Kanał głosowy, który chcesz dodać do nasłuchiwania."
            )
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Wyświetla listę kanałów, które są monitorowane.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Usuwa kanał głosowy z monitorowanych.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "Kanał głosowy, który chcesz usunąć z nasłuchiwania."
            )
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "add") {
      const channel = interaction.options.getChannel("channel");

      try {
        const existingConfig = await TempChannelConfiguration.findOne({
          guildId,
          channelId: channel.id,
        });

        if (existingConfig) {
          return interaction.reply({
            content: "Ten kanał jest już dodany do nasłuchiwania.",
            ephemeral: true,
          });
        }

        const newConfig = new TempChannelConfiguration({
          guildId,
          channelId: channel.id,
        });

        await newConfig.save();
        return interaction.reply({
          content: `Kanał ${channel.name} został dodany do nasłuchiwania.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error(`Błąd przy dodawaniu kanału do nasłuchiwania: ${error}`);
        return interaction.reply({
          content: "Wystąpił błąd podczas dodawania kanału.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "list") {
      try {
        const configs = await TempChannelConfiguration.find({ guildId });

        if (configs.length === 0) {
          return interaction.reply({
            content: "Brak monitorowanych kanałów.",
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("Monitorowane kanały")
          .setColor("#00BFFF");

        configs.forEach((config) => {
          const channel = interaction.guild.channels.cache.get(
            config.channelId
          );
          embed.addFields({
            name: "Kanał:",
            value: channel ? channel.name : `ID: ${config.channelId}`,
            inline: true,
          });
        });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error(`Błąd przy wyświetlaniu listy kanałów: ${error}`);
        return interaction.reply({
          content: "Wystąpił błąd podczas wyświetlania listy kanałów.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "remove") {
      const channel = interaction.options.getChannel("channel");

      try {
        const existingConfig = await TempChannelConfiguration.findOneAndDelete({
          guildId,
          channelId: channel.id,
        });

        if (!existingConfig) {
          return interaction.reply({
            content: "Ten kanał nie był monitorowany.",
            ephemeral: true,
          });
        }

        return interaction.reply({
          content: `Kanał ${channel.name} został usunięty z nasłuchiwania.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error(`Błąd przy usuwaniu kanału z nasłuchiwania: ${error}`);
        return interaction.reply({
          content: "Wystąpił błąd podczas usuwania kanału.",
          ephemeral: true,
        });
      }
    }
  },
};
