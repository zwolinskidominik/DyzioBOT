import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { deposit, getCurrencyConfig } from '../../services/economyService';
import { createDepositEmbed } from '../../utils/economyEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Wpłać monety z portfela do banku')
  .addStringOption((o) =>
    o
      .setName('kwota')
      .setDescription('Kwota do wpłaty lub "all"')
      .setRequired(true),
  );

export const options = { guildOnly: true };

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const raw = interaction.options.getString('kwota', true).trim().toLowerCase();

  const amount: number | 'all' = raw === 'all' ? 'all' : parseInt(raw, 10);

  if (amount !== 'all' && (isNaN(amount) || amount <= 0)) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Podaj poprawną kwotę (liczbę całkowitą > 0) lub "all".')],
    });
    return;
  }

  const [result, cfg] = await Promise.all([
    deposit(guildId, userId, amount),
    getCurrencyConfig(guildId),
  ]);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  await interaction.editReply({
    embeds: [
      createDepositEmbed(
        result.data.transferred,
        result.data.wallet,
        result.data.bank,
        cfg.currencySymbol,
      ),
    ],
  });
}
