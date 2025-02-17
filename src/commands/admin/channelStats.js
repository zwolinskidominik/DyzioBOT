const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const ChannelStats = require("../../models/ChannelStats");
const logger = require("../../utils/logger");

const keyMapping = {
  lastJoined: "lastJoined",
  users: "users",
  bots: "bots",
  bans: "bans",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel-stats")
    .setDescription(
      "Tworzy kanał statystyk serwera (ostatnia osoba, liczba użytkowników, botów, banów)"
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Wybierz typ kanału statystyk")
        .setRequired(true)
        .addChoices(
          { name: "Ostatnia osoba", value: "lastJoined" },
          { name: "Liczba użytkowników", value: "users" },
          { name: "Liczba botów", value: "bots" },
          { name: "Liczba banów", value: "bans" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("template")
        .setDescription(
          'Nazwa kanału (użyj "<>" jako placeholder, np. "<> osób")'
        )
        .setRequired(true)
    ),

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.options.getString("type");
      const template = interaction.options.getString("template");
      const { guild } = interaction;

      if (!template.includes("<>")) {
        return interaction.editReply({
          content: '❌ Nazwa kanału musi zawierać placeholder "<>"!',
        });
      }

      let value = "0";
      if (type === "users") {
        value = guild.members.cache.filter((m) => !m.user.bot).size;
      } else if (type === "bots") {
        value = guild.members.cache.filter((m) => m.user.bot).size;
      } else if (type === "bans") {
        try {
          const bans = await guild.bans.fetch();
          value = bans.size;
        } catch (error) {
          logger.error(`Błąd przy pobieraniu banów: ${error}`);
          value = "0";
        }
      } else if (type === "lastJoined") {
        const newestMember = guild.members.cache
          .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
          .first();
        value = newestMember ? newestMember.user.username : "Brak";
      }

      const newChannel = await guild.channels.create({
        name: template.replace(/<>/g, value),
        type: ChannelType.GuildVoice,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.Connect],
          },
        ],
      });

      let channelStats = await ChannelStats.findOne({ guildId: guild.id });
      if (!channelStats) {
        channelStats = new ChannelStats({
          guildId: guild.id,
          channels: {},
        });
      }

      const key = keyMapping[type];
      channelStats.channels[key] = {
        channelId: newChannel.id,
        template: template,
      };

      if (key === "lastJoined") {
        const newestMember = guild.members.cache
          .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
          .first();
        channelStats.channels[key].member = newestMember
          ? newestMember.id
          : null;
      }

      await channelStats.save();

      const embed = createBaseEmbed({
        title: "Kanał statystyk utworzony!",
        description: `Utworzono kanał **${newChannel.name}** dla statystyk: ${type}.`,
        footerText: interaction.user.tag,
        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Błąd podczas tworzenia kanału statystyk: ${error}`);
      await interaction.editReply({
        content: "Wystąpił błąd podczas tworzenia kanału statystyk.",
      });
    }
  },
};
