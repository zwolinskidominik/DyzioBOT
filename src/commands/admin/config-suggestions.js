const {
  EmbedBuilder,
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const SuggestionConfiguration = require("../../models/SuggestionConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-suggestions")
    .setDescription("Skonfiguruj kanały sugestii.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał sugestii.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał, który chcesz dodać.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("remove").setDescription("Usuwa kanał sugestii.")
    ),

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder().setColor("#FF0000");
    const successEmbed = new EmbedBuilder().setColor("#00BFFF");

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingConfig = await SuggestionConfiguration.findOne({ guildId });

      if (subcommand === "add") {
        if (
          existingConfig &&
          existingConfig.suggestionChannelId === channel.id
        ) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `${channel} jest już kanałem sugestii.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const config =
          existingConfig || new SuggestionConfiguration({ guildId });
        config.suggestionChannelId = channel.id;
        await config.save();

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              existingConfig
                ? `Zaktualizowano kanał sugestii na ${channel}.`
                : `Ustawiono kanał sugestii na ${channel}.`
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
                "Brak skonfigurowanego kanału sugestii."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await SuggestionConfiguration.findOneAndDelete({ guildId });

        await interaction.editReply({
          embeds: [successEmbed.setDescription("Usunięto kanał sugestii.")],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Błąd podczas konfigurowania kanałów sugestii: ${error}`);
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas konfigurowania kanałów sugestii."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
