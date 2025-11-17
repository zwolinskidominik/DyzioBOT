import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { modifyXp } from '../../services/xpService';
import { LevelModel } from '../../models/Level';
import { notifyLevelUp } from '../../services/levelNotifier';
import { computeLevelProgress } from '../../utils/levelMath';
import xpCache from '../../cache/xpCache';
import flushXp from '../../events/ready/xpFlush';

export const data = new SlashCommandBuilder()
  .setName('xp')
  .setDescription('Zarządzaj XP i poziomami użytkowników')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Dodaje XP')
      .addUserOption((o) => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
      .addIntegerOption((o) =>
        o.setName('ilosc').setDescription('Ilość XP').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Usuwa XP')
      .addUserOption((o) => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
      .addIntegerOption((o) =>
        o.setName('ilosc').setDescription('Ilość XP').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((s) =>
    s
      .setName('set')
      .setDescription('Ustawia konkretną wartość XP lub poziomu')
      .addUserOption((o) => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
      .addStringOption((o) =>
        o
          .setName('wartosc')
          .setDescription('Wartość XP lub poziom z suffixem L (np. 1000 lub 5L)')
          .setRequired(true)
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.inCachedGuild()) return;

  await interaction.deferReply();

  const gid = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser('uzytkownik', true);

  if (subcommand === 'set') {
    const valueStr = interaction.options.getString('wartosc', true);

    const isLevel = valueStr.toLowerCase().endsWith('l');
    const numericValue = parseInt(valueStr.replace(/[lL]$/, ''), 10);

    if (isNaN(numericValue) || numericValue < 0) {
      return interaction.editReply({
        content: '❌ Nieprawidłowa wartość. Użyj liczby lub liczby z suffixem L (np. 1000 lub 5L)',
      });
    }

    if (isLevel) {
      if (numericValue < 1) {
        return interaction.editReply({
          content: '❌ Poziom musi być większy niż 0',
        });
      }

      await LevelModel.findOneAndUpdate(
        { guildId: gid, userId: user.id },
        { level: numericValue, xp: 0 },
        { upsert: true }
      );

      xpCache.invalidateUser(gid, user.id);
      await flushXp();
      
      await notifyLevelUp(interaction.client, gid, user.id, numericValue).catch(() => null);

      return interaction.editReply({
        content: `🔧 Ustawiono poziom **${numericValue}** użytkownikowi <@${user.id}>`,
      });
    } else {
      const { level: calculatedLevel, xpIntoLevel } = computeLevelProgress(numericValue);
      
      await LevelModel.findOneAndUpdate(
        { guildId: gid, userId: user.id },
        { level: calculatedLevel, xp: xpIntoLevel },
        { upsert: true }
      );

      xpCache.invalidateUser(gid, user.id);
      await flushXp();

      return interaction.editReply({
        content: `🔧 Ustawiono **${numericValue}** punktów XP użytkownikowi <@${user.id}>`,
      });
    }
  }

  const amt = interaction.options.getInteger('ilosc', true);
  const delta = subcommand === 'add' ? amt : -amt;

  await modifyXp(interaction.client, gid, user.id, delta);
  const sign = delta > 0 ? '+' : '−';

  return interaction.editReply({
    content: `✅ ${sign}${Math.abs(delta)} XP dla <@${user.id}>`,
  });
}
