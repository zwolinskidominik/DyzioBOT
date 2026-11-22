import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { deposit, getCurrencyConfig } from '../../services/economyService';
import { createDepositEmbed } from '../../utils/economyEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Move coins from your wallet to the bank').setDescriptionLocalizations({ pl: 'Przenieś monety z portfela do banku' })
  .addStringOption((o) =>
    o
      .setName('amount')
      .setDescription('Amount to deposit or "all"').setDescriptionLocalizations({ pl: 'Kwota do wpłaty lub "all"' })
      .setRequired(true),
  );

export const options = { guildOnly: true, deleted: true };

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const raw = interaction.options.getString('amount', true).trim().toLowerCase();

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
