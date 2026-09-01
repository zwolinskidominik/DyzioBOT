import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { getLeaderboard, getCurrencyConfig, LeaderboardMode } from '../../services/economyService';
import { createLeaderboardEmbed } from '../../utils/economyEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT = 60_000;

const MODES = ['wealth', 'wallet', 'bank', 'earned', 'gambling'] as const;

type PageResult =
  | { ok: false; error: string }
  | { ok: true; embed: EmbedBuilder; totalPages: number };

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Sprawdź ranking najbogatszych użytkowników serwera')
  .addStringOption((o) =>
    o
      .setName('typ')
      .setDescription('Typ rankingu')
      .setRequired(false)
      .addChoices(
        { name: '💰 Bogactwo (net worth)', value: 'wealth' },
        { name: '👛 Portfel', value: 'wallet' },
        { name: '🏦 Bank', value: 'bank' },
        { name: '📈 Zarobione łącznie', value: 'earned' },
        { name: '🎲 Wygrane w grach', value: 'gambling' },
      ),
  );

export const options = { guildOnly: true, deleted: true };

function buildButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lb_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('lb_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const rawMode = interaction.options.getString('typ') ?? 'wealth';
  const mode: LeaderboardMode = (MODES as readonly string[]).includes(rawMode)
    ? (rawMode as LeaderboardMode)
    : 'wealth';

  const cfg = await getCurrencyConfig(guildId);
  let page = 1;

  const renderPage = async (p: number): Promise<PageResult> => {
    const result = await getLeaderboard(guildId, mode, p, PAGE_SIZE);
    if (!result.ok) return { ok: false, error: result.message };
    const totalPages = Math.max(1, Math.ceil(result.data.totalUsers / PAGE_SIZE));
    const embed = createLeaderboardEmbed(result.data, mode, p, totalPages, cfg.currencySymbol);
    return { ok: true, embed, totalPages };
  };

  const initial = await renderPage(1);
  if (!initial.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(initial.error)] });
    return;
  }

  const components = initial.totalPages > 1 ? [buildButtons(1, initial.totalPages)] : [];

  const reply = await interaction.editReply({
    embeds: [initial.embed],
    components,
  });

  if (initial.totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      await btn.reply({
        content: 'Uruchom własny `/leaderboard` aby nawigować.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (btn.customId === 'lb_prev') page = Math.max(1, page - 1);
    else if (btn.customId === 'lb_next') page += 1;

    const rendered = await renderPage(page);
    if (!rendered.ok) {
      await btn.update({ embeds: [createErrorEmbed(rendered.error)], components: [] });
      return;
    }

    await btn.update({
      embeds: [rendered.embed],
      components: [buildButtons(page, rendered.totalPages)],
    });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => undefined);
  });
}
