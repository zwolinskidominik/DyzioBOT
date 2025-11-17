import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { LevelConfigModel } from '../../models/LevelConfig';

export const data = new SlashCommandBuilder()
  .setName('channel-multiplier')
  .setDescription('Zarządzaj mnożnikami XP dla kanałów')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Dodaj mnożnik XP dla kanału')
      .addChannelOption((o) =>
        o.setName('kanal').setDescription('Kanał').setRequired(true)
      )
      .addNumberOption((o) =>
        o
          .setName('mnoznik')
          .setDescription('Mnożnik XP (np. 1.5 dla +50%, 0.5 dla -50%)')
          .setRequired(true)
          .setMinValue(0.1)
          .setMaxValue(10)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Usuń mnożnik XP dla kanału')
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanał').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Wyświetl listę mnożników XP dla kanałów')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [],
};

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const channel = interaction.options.getChannel('kanal', true);
    const multiplier = interaction.options.getNumber('mnoznik', true);

    await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $pull: { channelMultipliers: { channelId: channel.id } },
      },
      { upsert: true }
    );

    await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $push: { channelMultipliers: { channelId: channel.id, multiplier } },
      },
      { upsert: true }
    );

    return interaction.reply({
      content: `✅ Ustawiono mnożnik **${multiplier}x** dla kanału ${channel}`,
      ephemeral: true,
    });
  }

  if (subcommand === 'remove') {
    const channel = interaction.options.getChannel('kanal', true);

    await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $pull: { channelMultipliers: { channelId: channel.id } },
      }
    );

    return interaction.reply({
      content: `✅ Usunięto mnożnik XP dla kanału ${channel}`,
      ephemeral: true,
    });
  }

  if (subcommand === 'list') {
    const config = await LevelConfigModel.findOne({ guildId });

    if (!config || !config.channelMultipliers || config.channelMultipliers.length === 0) {
      return interaction.reply({
        content: '📊 Brak ustawionych mnożników XP dla kanałów',
        ephemeral: true,
      });
    }

    const list = config.channelMultipliers
      .map((cm) => `• <#${cm.channelId}> — **${cm.multiplier}x**`)
      .join('\n');

    return interaction.reply({
      content: `📊 **Mnożniki XP dla kanałów:**\n${list}`,
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: '❌ Nieznana podkomenda',
    ephemeral: true,
  });
}
