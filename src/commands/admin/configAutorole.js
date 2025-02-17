const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const AutoRole = require("../../models/AutoRole");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-autorole")
    .setDescription("Skonfiguruj autorole dla nowych użytkowników.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Skonfiguruj autorole dla serwera.")
        .addRoleOption((option) =>
          option
            .setName("role1")
            .setDescription("Rola która ma być nadawana botom.")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role2")
            .setDescription("Rola, która ma być nadawana nowym członkom.")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role3")
            .setDescription("Rola 3 (opcjonalna)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role4")
            .setDescription("Rola 4 (opcjonalna)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role5")
            .setDescription("Rola 5 (opcjonalna)")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("role6")
            .setDescription("Rola 6 (opcjonalna)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Wyłącz autorole dla tego serwera.")
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      let existingConfig = await AutoRole.findOne({ guildId });

      if (subcommand === "add") {
        const roles = interaction.options._hoistedOptions.map(
          (option) => option.value
        );

        if (roles.includes(interaction.guild.id)) {
          await interaction.reply({
            embeds: [
              errorEmbed.setDescription(
                "Nie można skonfigurować roli `@everyone`."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        if (existingConfig) {
          existingConfig.roleIds = roles;
          await existingConfig.save();
        } else {
          await new AutoRole({ guildId, roleIds: roles }).save();
        }

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              "Autorole zostały skonfigurowane. \nAby wyłączyć, uruchom `/config-autorole remove`."
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
                "Autorole nie są skonfigurowane. \nAby skonfigurować, uruchom `/config-autorole add`."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await AutoRole.findOneAndDelete({ guildId });
        logger.info(`Usunięto konfigurację autorole w guildId: ${guildId}`);

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              "Autorole zostały wyłączone dla tego serwera. \nAby skonfigurować ponownie, uruchom `/config-autorole add`."
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    } catch (error) {
      logger.error(`Wystąpił błąd podczas konfigurowania autoroli: ${error}`);

      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "Wystąpił błąd podczas konfigurowania autoroli."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
