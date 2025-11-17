import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';
import { LevelConfigModel } from '../../models/LevelConfig';

export const data = new SlashCommandBuilder()
  .setName('xp-multiplier')
  .setDescription('Zarządzaj mnożnikami XP dla ról')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Dodaj mnożnik XP dla roli')
      .addRoleOption((o) => o.setName('rola').setDescription('Rola').setRequired(true))
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
      .setDescription('Usuń mnożnik XP dla roli')
      .addRoleOption((o) => o.setName('rola').setDescription('Rola').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Wyświetl listę mnożników XP dla ról')
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.inCachedGuild()) return;

  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const role = interaction.options.getRole('rola', true);
    const multiplier = interaction.options.getNumber('mnoznik', true);

    await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $pull: { roleMultipliers: { roleId: role.id } },
      },
      { upsert: true }
    );

    await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $push: { roleMultipliers: { roleId: role.id, multiplier } },
      },
      { upsert: true }
    );

    await interaction.reply({
      content: `✅ Ustawiono mnożnik **${multiplier}x** dla roli ${role}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (subcommand === 'remove') {
    const role = interaction.options.getRole('rola', true);

    const result = await LevelConfigModel.findOneAndUpdate(
      { guildId },
      {
        $pull: { roleMultipliers: { roleId: role.id } },
      },
      { new: true }
    );

    if (!result) {
      await interaction.reply({
        content: '❌ Nie znaleziono konfiguracji dla tego serwera',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Usunięto mnożnik XP dla roli ${role}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (subcommand === 'list') {
    const config = await LevelConfigModel.findOne({ guildId }).lean();

    if (!config || !config.roleMultipliers || config.roleMultipliers.length === 0) {
      await interaction.reply({
        content: '📊 Brak ustawionych mnożników XP dla ról',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const list = config.roleMultipliers
      .map((rm) => `• <@&${rm.roleId}> — **${rm.multiplier}x**`)
      .join('\n');

    await interaction.reply({
      content: `📊 **Mnożniki XP dla ról:**\n${list}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
