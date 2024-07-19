const {
  EmbedBuilder,
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const GreetingsConfiguration = require("../../models/GreetingsConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-greetings")
    .setDescription("Skonfiguruj karty powitalne.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał powitań.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał, który chcesz ustawić jako kanał powitań.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("remove").setDescription("Usuwa kanał powitań.")
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

      const existingConfig = await GreetingsConfiguration.findOne({ guildId });

      if (subcommand === "add") {
        if (
          existingConfig &&
          existingConfig.greetingsChannelId === channel.id
        ) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `Kanał ${channel} jest już ustawiony jako kanał powitań.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }
        const config =
          existingConfig || new GreetingsConfiguration({ guildId });
        config.greetingsChannelId = channel.id;
        await config.save();

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              existingConfig
                ? `Zaktualizowano kanał powitań na ${channel}.`
                : `Ustawiono kanał powitań na ${channel}.`
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
                "Brak skonfigurowanego kanału powitań."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await GreetingsConfiguration.findOneAndDelete({ guildId });
        await interaction.editReply({
          embeds: [successEmbed.setDescription("Usunięto kanał powitań.")],
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
