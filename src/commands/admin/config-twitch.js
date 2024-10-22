const {
  EmbedBuilder,
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const StreamChannel = require("../../models/StreamConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-twitch")
    .setDescription("Ustawia kanał Discorda do ogłaszania streamów Twitcha.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał do powiadomień o streamach Twitch.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał Discorda do ogłaszania streamów z Twitcha.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Usuwa kanał do powiadomień o streamach Twitch.")
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingConfig = await StreamChannel.findOne({ guildId });

      if (subcommand === "add") {
        if (existingConfig && existingConfig.channelId === channel.id) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `Kanał ${channel} jest już ustawiony jako kanał powiadomień o streamach Twitch.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const config = existingConfig || new StreamChannel({ guildId });
        config.channelId = channel.id;
        await config.save();

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              existingConfig
                ? `Zaktualizowano kanał powiadomień o streamach Twitch na ${channel}.`
                : `Ustawiono kanał powiadomień o streamach Twitch na ${channel}.`
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (subcommand === "remove") {
        if (!existingConfig) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                "Nie znaleziono skonfigurowanego kanału do usunięcia."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await StreamChannel.findOneAndDelete({ guildId });

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              `Kanał ${channel} został usunięty z powiadomień o streamach Twitch.`
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Błąd podczas zapisywania konfiguracji kanału: ${error}`);

      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas zapisywania konfiguracji kanału."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
