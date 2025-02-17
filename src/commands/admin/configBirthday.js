const {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const BirthdayConfiguration = require("../../models/BirthdayConfiguration");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-birthday")
    .setDescription("Skonfiguruj kanał do wysyłania życzeń urodzinowych.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał do wysyłania życzeń urodzinowych.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał do wysyłania życzeń urodzinowych.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Usuwa kanał do wysyłania życzeń urodzinowych.")
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

      const existingConfig = await BirthdayConfiguration.findOne({ guildId });

      if (subcommand === "add") {
        if (existingConfig && existingConfig.birthdayChannelId === channel.id) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `Kanał ${channel} jest już ustawiony jako kanał do wysyłania życzeń urodzinowych.\nAby wyłączyć, uruchom \`/config-birthday remove\`.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }
        const config = existingConfig || new BirthdayConfiguration({ guildId });
        config.birthdayChannelId = channel.id;
        await config.save();

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              existingConfig
                ? `Zaktualizowano kanał do wysyłania życzeń urodzinowych na ${channel}.\nAby wyłączyć, uruchom \`/config-birthday remove\`.`
                : `Ustawiono kanał do wysyłania życzeń urodzinowych na ${channel}\nAby wyłączyć, uruchom \`/config-birthday remove\`.`
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
                "Brak skonfigurowanego kanału do wysyłania życzeń urodzinowych.\nAby skonfigurować, uruchom `/config-birthday add`."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await BirthdayConfiguration.findOneAndDelete({ guildId });
        logger.info(`Usunięto kanał urodzin w guildId=${guildId}`);

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              "Usunięto kanał do wysyłania życzeń urodzinowych.\nAby skonfigurować ponownie, uruchom `/config-birthday add`."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error(`Błąd podczas zapisywania konfiguracji kanału: ${error}`);
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
