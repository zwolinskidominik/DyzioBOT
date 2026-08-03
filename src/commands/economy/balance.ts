import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getBalance, getCurrencyConfig, getUserRank } from '../../services/economyService';
import { createBalanceEmbed } from '../../utils/economyEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Sprawdź swój portfel lub portfel innego użytkownika')
  .addUserOption((o) =>
    o.setName('uzytkownik').setDescription('Domyślnie Ty').setRequired(false),
  );

export const options = { guildOnly: true };

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const target = interaction.options.getUser('uzytkownik') ?? interaction.user;

  if (target.bot) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Boty nie mają portfela.')],
    });
    return;
  }

  const [balResult, cfgResult, rankResult] = await Promise.all([
    getBalance(guildId, target.id),
    getCurrencyConfig(guildId),
    getUserRank(guildId, target.id),
  ]);

  if (!balResult.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(balResult.message)] });
    return;
  }

  const rank = rankResult.ok ? rankResult.data : 0;
  await interaction.editReply({
    embeds: [createBalanceEmbed(target, balResult.data, cfgResult, rank)],
  });
}
