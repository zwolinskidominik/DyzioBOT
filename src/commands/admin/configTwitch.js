const {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const StreamChannel = require("../../models/StreamConfiguration");
const logger = require("../../utils/logger");

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
    const errorEmbed = createBaseEmbed({ isError: true });
    const successEmbed = createBaseEmbed();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingConfig = await StreamChannel.findOne({ guildId });

      if (subcommand === "add") {
        const channel = interaction.options.getChannel("channel");
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

        const channelFromConfig = interaction.guild.channels.cache.get(
          existingConfig.channelId
        );
        const channelDisplay = channelFromConfig
          ? `<#${channelFromConfig.id}>`
          : "Kanał (nie znaleziony)";

        await StreamChannel.findOneAndDelete({ guildId });

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              `Kanał ${channelDisplay} został usunięty z powiadomień o streamach Twitch.`
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
