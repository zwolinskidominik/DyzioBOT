import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  AutocompleteInteraction,
  MessageFlags,
} from 'discord.js';
import { LogConfigurationModel } from '../../models/LogConfiguration';
import { LogEventType, LOG_EVENT_CONFIGS } from '../../interfaces/LogEvent';

export const data = new SlashCommandBuilder()
  .setName('config-logs')
  .setDescription('Konfiguracja systemu logów')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('set-channel')
      .setDescription('Ustaw kanał dla konkretnego typu logu')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Typ logu')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Kanał docelowy dla logów')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('enable')
      .setDescription('Włącz konkretny typ logu')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Typ logu')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('disable')
      .setDescription('Wyłącz konkretny typ logu')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Typ logu')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('set-all-channel')
      .setDescription('Ustaw jeden kanał dla WSZYSTKICH logów')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Kanał docelowy')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('enable-all').setDescription('Włącz wszystkie typy logów')
  )
  .addSubcommand(sub =>
    sub.setName('disable-all').setDescription('Wyłącz wszystkie typy logów')
  )
  .addSubcommand(sub =>
    sub.setName('show').setDescription('Pokaż obecną konfigurację logów')
  );

export async function autocomplete({ interaction }: { interaction: AutocompleteInteraction }) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  
  const choices = Object.entries(LOG_EVENT_CONFIGS).map(([value, config]) => ({
    name: `${config.emoji} ${config.name}`,
    value: value,
  }));

  const filtered = choices.filter(choice =>
    choice.name.toLowerCase().includes(focusedValue) ||
    choice.value.toLowerCase().includes(focusedValue)
  );

  await interaction.respond(filtered.slice(0, 25));
}

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.guildId) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set-channel':
      await handleSetChannel(interaction);
      break;
    case 'enable':
      await handleEnable(interaction);
      break;
    case 'disable':
      await handleDisable(interaction);
      break;
    case 'set-all-channel':
      await handleSetAllChannel(interaction);
      break;
    case 'enable-all':
      await handleEnableAll(interaction);
      break;
    case 'disable-all':
      await handleDisableAll(interaction);
      break;
    case 'show':
      await handleView(interaction);
      break;
  }
}

async function handleSetChannel(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const eventType = interaction.options.getString('type', true) as LogEventType;
  const channel = interaction.options.getChannel('channel', true);

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: { [`logChannels.${eventType}`]: channel.id } },
    { upsert: true }
  );

  const config = LOG_EVENT_CONFIGS[eventType];
  await interaction.reply({
    content: `✅ Ustawiono kanał ${channel} dla logów: **${config.emoji} ${config.name}**`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleEnable(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const eventType = interaction.options.getString('type', true) as LogEventType;

  const logConfig = await LogConfigurationModel.findOne({ guildId });
  
  if (!logConfig?.logChannels?.[eventType]) {
    await interaction.reply({
      content: `❌ Najpierw ustaw kanał dla tego typu logu używając \`/config-logs set-channel\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: { [`enabledEvents.${eventType}`]: true } },
    { upsert: true }
  );

  const config = LOG_EVENT_CONFIGS[eventType];
  await interaction.reply({
    content: `✅ Włączono logi: **${config.emoji} ${config.name}**`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDisable(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const eventType = interaction.options.getString('type', true) as LogEventType;

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: { [`enabledEvents.${eventType}`]: false } },
    { upsert: true }
  );

  const config = LOG_EVENT_CONFIGS[eventType];
  await interaction.reply({
    content: `✅ Wyłączono logi: **${config.emoji} ${config.name}**`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSetAllChannel(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const channel = interaction.options.getChannel('channel', true);

  const updates: Record<string, string> = {};
  for (const eventType of Object.keys(LOG_EVENT_CONFIGS)) {
    updates[`logChannels.${eventType}`] = channel.id;
  }

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true }
  );

  await interaction.reply({
    content: `✅ Ustawiono kanał ${channel} dla **wszystkich** typów logów`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleEnableAll(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  const updates: Record<string, boolean> = {};
  for (const eventType of Object.keys(LOG_EVENT_CONFIGS)) {
    updates[`enabledEvents.${eventType}`] = true;
  }

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true }
  );

  await interaction.reply({
    content: `✅ Włączono **wszystkie** typy logów`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDisableAll(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  const updates: Record<string, boolean> = {};
  for (const eventType of Object.keys(LOG_EVENT_CONFIGS)) {
    updates[`enabledEvents.${eventType}`] = false;
  }

  await LogConfigurationModel.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true }
  );

  await interaction.reply({
    content: `✅ Wyłączono **wszystkie** typy logów`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const config = await LogConfigurationModel.findOne({ guildId }).lean();

  if (!config) {
    await interaction.reply({
      content: '❌ Brak konfiguracji logów. Użyj `/config-logs set-channel` aby rozpocząć.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Konfiguracja Logów')
    .setColor(0x3498DB)
    .setTimestamp();

  const enabledLogs: string[] = [];
  const disabledLogs: string[] = [];

  for (const [eventType, eventConfig] of Object.entries(LOG_EVENT_CONFIGS)) {
    const isEnabled = config.enabledEvents?.[eventType as LogEventType];
    const channelId = config.logChannels?.[eventType as LogEventType];
    const channel = channelId ? `<#${channelId}>` : '❌';

    const line = `${eventConfig.emoji} ${eventConfig.name} → ${channel}`;

    if (isEnabled) {
      enabledLogs.push(line);
    } else {
      disabledLogs.push(line);
    }
  }

  const chunkSize = 15;
  
  if (enabledLogs.length > 0) {
    for (let i = 0; i < enabledLogs.length; i += chunkSize) {
      const chunk = enabledLogs.slice(i, i + chunkSize);
      const fieldName = i === 0 ? '✅ Włączone' : '✅ Włączone (cd.)';
      embed.addFields({
        name: fieldName,
        value: chunk.join('\n'),
        inline: false,
      });
    }
  } else {
    embed.addFields({
      name: '✅ Włączone',
      value: '*Brak włączonych logów*',
      inline: false,
    });
  }

  if (disabledLogs.length > 0) {
    for (let i = 0; i < disabledLogs.length; i += chunkSize) {
      const chunk = disabledLogs.slice(i, i + chunkSize);
      const fieldName = i === 0 ? '❌ Wyłączone' : '❌ Wyłączone (cd.)';
      embed.addFields({
        name: fieldName,
        value: chunk.join('\n'),
        inline: false,
      });
    }
  } else {
    embed.addFields({
      name: '❌ Wyłączone',
      value: '*Brak wyłączonych logów*',
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
