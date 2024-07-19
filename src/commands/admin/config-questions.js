const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const QuestionConfiguration = require("../../models/QuestionConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-questions")
    .setDescription("Skonfiguruj pytania dnia.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Dodaje kanał dla pytań dnia.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał, który chcesz dodać.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("ping_role")
            .setDescription(
              "Rola, która będzie pingowana przy dodawaniu pytania dnia."
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("remove").setDescription("Usuwa kanał dla pytań dnia.")
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
    const pingRole = interaction.options.getRole("ping_role");
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingConfig = await QuestionConfiguration.findOne({ guildId });

      if (subcommand === "add") {
        if (existingConfig && existingConfig.questionChannelId === channel.id) {
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `Kanał ${channel} jest już ustawiony jako kanał pytań dnia.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const config = existingConfig || new QuestionConfiguration({ guildId });
        config.questionChannelId = channel.id;
        config.pingRoleId = pingRole ? pingRole.id : null;
        await config.save();

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              existingConfig
                ? `Zaktualizowano kanał pytań dnia na ${channel}.`
                : `Ustawiono kanał pytań dnia na ${channel}.`
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
                "Brak skonfigurowanego kanału pytań dnia."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await QuestionConfiguration.findOneAndDelete({ guildId });
        await interaction.editReply({
          embeds: [successEmbed.setDescription("Usunięto kanał pytań dnia.")],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Błąd podczas konfigurowania kanału pytań dnia: ${error}`);
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas konfigurowania kanału pytań dnia."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
