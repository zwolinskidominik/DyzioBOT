import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { modifyXp, setXp, setLevel, flush } from '../../services/xpService';
import { notifyLevelUp } from '../../services/levelNotifier';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

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

export const options = {
  guildOnly: true,
};

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  try {
    const gid = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('uzytkownik', true);

    if (subcommand === 'set') {
      const valueStr = interaction.options.getString('wartosc', true);

      const isLevelSet = valueStr.toLowerCase().endsWith('l');
      const numericValue = parseInt(valueStr.replace(/[lL]$/, ''), 10);

      if (isNaN(numericValue) || numericValue < 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Nieprawidłowa wartość. Użyj liczby lub liczby z suffixem L (np. 1000 lub 5L)')],
        });
      }

      if (isLevelSet) {
        const result = await setLevel(gid, user.id, numericValue);
        if (!result.ok) {
          return interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
        }

        await flush();
        await notifyLevelUp(interaction.client, gid, user.id, result.data.level).catch(() => null);

        return interaction.editReply({
          content: `🔧 Ustawiono poziom **${result.data.level}** użytkownikowi <@${user.id}>`,
        });
      } else {
        const result = await setXp(gid, user.id, numericValue);
        if (!result.ok) {
          return interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
        }

        await flush();
        await notifyLevelUp(interaction.client, gid, user.id, result.data.level).catch(() => null);

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
  } catch (error) {
    logger.error(`[xp] Błąd wykonania komendy: ${error}`);
    return interaction.editReply({ embeds: [createErrorEmbed('Wystąpił błąd podczas wykonywania komendy.')] });
  }
}
