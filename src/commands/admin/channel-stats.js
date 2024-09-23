const {
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const ChannelStats = require("../../models/ChannelStats");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel-stats")
    .setDescription("Opcje dotyczące kanałów statystyk")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Ustaw kanały ze statystykami")
        .addStringOption((option) =>
          option
            .setName("kanal")
            .setDescription("Kanał, który cię interesuje!")
            .setRequired(true)
            .addChoices(
              { name: "Osoby", value: "people_channel" },
              { name: "Boty", value: "bots_channel" },
              { name: "Bany", value: "bans_channel" },
              { name: "Najnowsza osoba", value: "newest_channel" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("nazwa")
            .setDescription(
              'Nazwa kanału, użyj <>, aby miejsce statystyki, np. "<> osób", lub "Zbanowano <> osób"!'
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Zmień ustawienia dotyczące kanału statystyk")
        .addStringOption((option) =>
          option
            .setName("kanal")
            .setDescription("Kanał który cię interesuje!")
            .setRequired(true)
            .addChoices(
              { name: "Osoby", value: "people_channel" },
              { name: "Boty", value: "bots_channel" },
              { name: "Bany", value: "bans_channel" },
              { name: "Najnowsza osoba", value: "newest_channel" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("nazwa")
            .setDescription("Na jaką nazwę chcesz zmienić?")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Kanał statystyk, który chcesz usunąć")
        .addStringOption((option) =>
          option
            .setName("kanal")
            .setDescription("Kanał który cię interesuje!")
            .setRequired(true)
            .addChoices(
              { name: "Osoby", value: "people_channel" },
              { name: "Boty", value: "bots_channel" },
              { name: "Bany", value: "bans_channel" },
              { name: "Najnowsza osoba", value: "newest_channel" }
            )
        )
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getString("kanal");
    const name = interaction.options?.getString("nazwa");
    const { guild } = interaction;

    let channelStats = await ChannelStats.findOne({ guildId: guild.id });
    if (!channelStats) {
      channelStats = await new ChannelStats({ guildId: guild.id }).save();
    }

    const embed = new EmbedBuilder()
      .setFooter({
        text: interaction.user.displayName,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const handlers = {
      setup: handleSetup,
      edit: handleEdit,
      delete: handleDelete,
    };

    await handlers[subcommand](interaction, channelStats, channel, name, embed);
  },
};

async function handleSetup(interaction, channelStats, channel, name, embed) {
  if (!name.includes("<>")) {
    return interaction.reply({
      content: `❌ Nazwa kanału musi zawierać \`<>\` w sobie!\n> Na przykład: \`<> osób online\`, które będzie wyglądać jak \`15 osób online\``,
      ephemeral: true,
    });
  }

  const { guild } = interaction;
  embed
    .setColor("#00ff00")
    .setDescription(`✔️ Kanał statystyk został ustawiony!`);

  let value;
  switch (channel) {
    case "people_channel":
      value = guild.members.cache.filter((member) => !member.user.bot).size;
      break;
    case "bots_channel":
      value = guild.members.cache.filter((member) => member.user.bot).size;
      break;
    case "bans_channel":
      const bans = await guild.bans.fetch();
      value = bans.size;
      break;
    case "newest_channel":
      const newestMember = guild.members.cache
        .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
        .first();
      value = newestMember ? newestMember.user.username : "Brak";
      break;
  }

  const newChannel = await guild.channels.create({
    name: name.replace(/<>/g, value),
    type: ChannelType.GuildVoice,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect],
      },
    ],
  });

  channelStats.channels[channel] = {
    channelId: newChannel.id,
    channelName: name,
  };

  if (channel === "newest_channel") {
    channelStats.channels[channel].member = newestMember
      ? newestMember.id
      : null;
  }

  await channelStats.save();

  interaction.reply({ embeds: [embed] });
}

async function handleEdit(interaction, channelStats, channel, name, embed) {
  if (!name.includes("<>")) {
    return interaction.reply({
      content: `❌ Nazwa kanału musi zawierać \`<>\` w sobie!\n> Na przykład: \`<> osób online\`, które będzie wyglądać jak \`15 osób online\``,
      ephemeral: true,
    });
  }

  await updateChannelSettings(channelStats, channel, { channelName: name });

  const { guild } = interaction;
  const channelId = channelStats.channels[channel]?.channelId;
  if (channelId) {
    const existingChannel = guild.channels.cache.get(channelId);
    if (existingChannel) {
      let value;
      switch (channel) {
        case "people_channel":
          value = guild.members.cache.filter((member) => !member.user.bot).size;
          break;
        case "bots_channel":
          value = guild.members.cache.filter((member) => member.user.bot).size;
          break;
        case "bans_channel":
          const bans = await guild.bans.fetch();
          value = bans.size;
          break;
        case "newest_channel":
          const newestMember = guild.members.cache
            .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
            .first();
          value = newestMember ? newestMember.user.username : "Brak";
          break;
      }
      await existingChannel.setName(name.replace(/<>/g, value));
    }
  }

  embed
    .setColor("#00ff00")
    .setDescription(`✔️ Ustawienia kanału statystyk zostały zaktualizowane!`);

  interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction, channelStats, channel, _, embed) {
  const { guild } = interaction;
  const channelId = channelStats.channels[channel]?.channelId;

  if (channelId) {
    const channelToDelete = guild.channels.cache.get(channelId);
    if (channelToDelete) {
      await channelToDelete.delete();
    }
  }

  await updateChannelSettings(channelStats, channel, {
    channelId: null,
    channelName: null,
  });

  embed
    .setColor("#ff0000")
    .setDescription(`✔️ Kanał statystyk został usunięty!`);

  interaction.reply({ embeds: [embed] });
}

async function updateChannelSettings(channelStats, channel, settings) {
  channelStats.channels[channel] = {
    ...channelStats.channels[channel],
    ...settings,
  };
  await channelStats.save();
}
