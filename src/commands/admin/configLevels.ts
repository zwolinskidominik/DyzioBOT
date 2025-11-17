import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { LevelConfigModel } from '../../models/LevelConfig';
import { COLORS } from '../../config/constants/colors';

export const data = new SlashCommandBuilder()
  .setName('config-levels')
  .setDescription('Zarządzaj systemem poziomów')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Wyświetl obecną konfigurację systemu poziomów')
  )
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Ustaw parametry systemu poziomów')
      .addChannelOption((o) =>
        o.setName('kanal').setDescription('Kanał powiadomień o level-upach').setRequired(true)
      )
      .addIntegerOption((o) => o.setName('xp_per_msg').setDescription('XP za wiadomość').setMinValue(1))
      .addIntegerOption((o) =>
        o.setName('xp_per_min_vc').setDescription('XP za minutę na VC').setMinValue(1)
      )
      .addIntegerOption((o) =>
        o
          .setName('cooldown_sec')
          .setDescription('Cooldown między wiadomościami (sekundy)')
          .setMinValue(0)
      )
      .addStringOption((o) =>
        o.setName('level_msg').setDescription('Szablon wiadomości za wbicie poziomu')
      )
      .addStringOption((o) =>
        o.setName('reward_msg').setDescription('Szablon wiadomości za otrzymanie roli za poziom')
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('toggle-notifications')
      .setDescription('Włącz lub wyłącz powiadomienia o level-upach')
      .addBooleanOption((o) =>
        o
          .setName('enable')
          .setDescription('Czy włączyć powiadomienia? (true = włącz, false = wyłącz)')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'show') {
    return await handleShow(interaction);
  } else if (subcommand === 'set') {
    return await handleSet(interaction);
  } else if (subcommand === 'toggle-notifications') {
    return await handleToggleNotifications(interaction);
  }
}

async function handleShow(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const config = await LevelConfigModel.findOne({ guildId }).lean();

  if (!config) {
    await interaction.reply({
      content: '⚠️ System poziomów nie jest skonfigurowany na tym serwerze.\nUżyj `/config-levels set` aby go skonfigurować.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.DEFAULT)
    .setTitle('⚙️ Konfiguracja systemu poziomów')
    .addFields(
      {
        name: '📢 Kanał powiadomień',
        value: config.notifyChannelId ? `<#${config.notifyChannelId}>` : '❌ Nie ustawiono',
        inline: false,
      },
      {
        name: '🔔 Powiadomienia o level-upach',
        value: config.enableLevelUpMessages ? '✅ Włączone' : '❌ Wyłączone',
        inline: false,
      },
      {
        name: '💬 XP za wiadomość',
        value: `${config.xpPerMsg ?? 5} XP`,
        inline: false,
      },
      {
        name: '🎤 XP za minutę na VC',
        value: `${config.xpPerMinVc ?? 10} XP`,
        inline: false,
      },
      {
        name: '⏱️ Cooldown',
        value: `${config.cooldownSec ?? 0} sekund`,
        inline: false,
      },
      {
        name: '🎊 Wiadomość level-up',
        value: `\`${config.levelUpMessage || '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏'}\``,
        inline: false,
      },
      {
        name: '🎁 Wiadomość nagrody',
        value: `\`${config.rewardMessage || '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!'}\``,
        inline: false,
      }
    )
    .setFooter({ text: 'Użyj /config-levels set aby zmienić ustawienia' });

  if (config.ignoredChannels && config.ignoredChannels.length > 0) {
    embed.addFields({
      name: '🚫 Ignorowane kanały',
      value: config.ignoredChannels.map((id) => `<#${id}>`).join(', '),
      inline: false,
    });
  }

  if (config.ignoredRoles && config.ignoredRoles.length > 0) {
    embed.addFields({
      name: '🚫 Ignorowane role',
      value: config.ignoredRoles.map((id) => `<@&${id}>`).join(', '),
      inline: false,
    });
  }

  if (config.roleMultipliers && config.roleMultipliers.length > 0) {
    embed.addFields({
      name: '✨ Mnożniki ról',
      value: config.roleMultipliers.map((m) => `<@&${m.roleId}>: **${m.multiplier}x**`).join('\n'),
      inline: false,
    });
  }

  if (config.channelMultipliers && config.channelMultipliers.length > 0) {
    embed.addFields({
      name: '✨ Mnożniki kanałów',
      value: config.channelMultipliers.map((m) => `<#${m.channelId}>: **${m.multiplier}x**`).join('\n'),
      inline: false,
    });
  }

  if (config.roleRewards && config.roleRewards.length > 0) {
    const rewards = config.roleRewards
      .sort((a, b) => a.level - b.level)
      .map((r) => `Poziom **${r.level}**: <@&${r.roleId}>`)
      .join('\n');
    embed.addFields({
      name: '🏆 Nagrody-role',
      value: rewards,
      inline: false,
    });
  }

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSet(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const notifyChannelId = interaction.options.getChannel('kanal', true).id;
  const xpPerMsg = interaction.options.getInteger('xp_per_msg') ?? undefined;
  const xpPerMinVc = interaction.options.getInteger('xp_per_min_vc') ?? undefined;
  const cooldownSec = interaction.options.getInteger('cooldown_sec') ?? undefined;
  const levelUpMessage = interaction.options.getString('level_msg') ?? undefined;
  const rewardMessage = interaction.options.getString('reward_msg') ?? undefined;

  await LevelConfigModel.findOneAndUpdate(
    { guildId },
    {
      $set: {
        notifyChannelId,
        ...(xpPerMsg !== undefined && { xpPerMsg }),
        ...(xpPerMinVc !== undefined && { xpPerMinVc }),
        ...(cooldownSec !== undefined && { cooldownSec }),
        ...(levelUpMessage !== undefined && { levelUpMessage }),
        ...(rewardMessage !== undefined && { rewardMessage }),
      },
    },
    { upsert: true }
  );

  await interaction.reply({
    content: `✅ Konfiguracja leveli zapisana.\nUżyj \`/config-levels show\` aby sprawdzić ustawienia.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleToggleNotifications(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const enable = interaction.options.getBoolean('enable', true);

  await LevelConfigModel.findOneAndUpdate(
    { guildId },
    { $set: { enableLevelUpMessages: enable } },
    { upsert: true }
  );

  await interaction.reply({
    content: enable
      ? '✅ Powiadomienia o level-upach zostały **włączone**.'
      : '❌ Powiadomienia o level-upach zostały **wyłączone**.',
    flags: MessageFlags.Ephemeral,
  });
}
