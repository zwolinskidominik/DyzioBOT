const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const QuestionConfiguration = require("../../models/QuestionConfiguration");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-questions")
    .setDescription("Skonfiguruj kanał pytań dnia.")
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
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");
    const pingRole = interaction.options.getRole("ping_role");
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingConfig = await QuestionConfiguration.findOne({ guildId });
      const pingText = pingRole
        ? `\nRola do pingowania ustawiona na <@&${pingRole.id}>.`
        : "";

      if (subcommand === "add") {
        if (existingConfig && existingConfig.questionChannelId === channel.id) {
          if (pingRole && existingConfig.pingRoleId !== pingRole.id) {
            existingConfig.pingRoleId = pingRole.id;
            await existingConfig.save();
            await interaction.editReply({
              embeds: [
                successEmbed.setDescription(
                  `Zaktualizowano kanał pytań dnia na ${channel}.${pingText}\nAby wyłączyć, uruchom \`/config-questions remove\`.`
                ),
              ],
              ephemeral: true,
            });
            return;
          }
          await interaction.editReply({
            embeds: [
              errorEmbed.setDescription(
                `Kanał ${channel} jest już ustawiony jako kanał pytań dnia.\nAby wyłączyć, uruchom \`/config-questions remove\`.`
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
              `Ustawiono kanał pytań dnia na ${channel}.${pingText}\nAby wyłączyć, uruchom \`/config-questions remove\`.`
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
                "Brak skonfigurowanego kanału pytań dnia.\nAby skonfigurować, uruchom `/config-questions add`."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await QuestionConfiguration.findOneAndDelete({ guildId });
        logger.info(`Usunięto kanał pytań dnia w guildId=${guildId}`);

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              "Usunięto kanał pytań dnia.\nAby skonfigurować ponownie, uruchom `/config-questions add`."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error(`Błąd podczas konfigurowania kanału pytań dnia: ${error}`);
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
