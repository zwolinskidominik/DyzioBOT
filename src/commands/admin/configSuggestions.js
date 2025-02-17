const {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const SuggestionConfiguration = require("../../models/SuggestionConfiguration");
const logger = require("../../utils/logger");

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

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

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
                `${channel} jest już kanałem sugestii.\nAby wyłączyć, uruchom \`/config-suggestions remove\`.`
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
                ? `Zaktualizowano kanał sugestii na ${channel}.\nAby wyłączyć, uruchom \`/config-suggestions remove\`.`
                : `Ustawiono kanał sugestii na ${channel}.\nAby wyłączyć, uruchom \`/config-suggestions remove\`.`
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
                "Brak skonfigurowanego kanału sugestii.\nAby skonfigurować, uruchom `/config-suggestions add`."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await SuggestionConfiguration.findOneAndDelete({ guildId });
        logger.info(`Usunięto kanał sugestii w guildId=${guildId}`);

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              "Usunięto kanał sugestii.\nAby skonfigurować ponownie, uruchom `/config-suggestions add`."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error(`Błąd podczas konfigurowania kanałów sugestii: ${error}`);
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
