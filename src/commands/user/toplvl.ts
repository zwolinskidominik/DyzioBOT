import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { getLeaderboard } from '../../services/xpService';
import { CanvasLeaderboardCard } from '../../utils/canvasLeaderboardCard';
import { createErrorEmbed } from '../../utils/embedHelpers';
import flushXp from '../../events/clientReady/xpFlush';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('toplvl')
  .setDescription('Wyświetla top 10 użytkowników z najwyższym poziomem na serwerze')
  .addIntegerOption((option) =>
    option
      .setName('strona')
      .setDescription('Numer strony (1 = miejsca 1-10, 2 = miejsca 11-20, itd.)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  );

export const options = {
  guildOnly: true,
};

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const page = interaction.options.getInteger('strona') ?? 1;
  const perPage = 10;

  await flushXp();

  const result = await getLeaderboard(guildId, page, perPage);

  if (!result.ok) {
    if (result.code === 'NO_USERS') {
      await interaction.reply({
        embeds: [createErrorEmbed('Brak użytkowników z poziomami na tym serwerze!')],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed(result.message)],
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  const { entries: paginatedUsers } = result.data;
  const skip = (page - 1) * perPage;

  await interaction.deferReply();

  const leaderboardEntries = await Promise.all(
    paginatedUsers.map(async (userData, index) => {
      try {
        const user = await interaction.client.users.fetch(userData.userId);
        return {
          username: user.username,
          level: userData.level,
          totalXP: userData.totalXp,
          rank: skip + index + 1,
          avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 }),
        };
      } catch (error) {
        logger.error(`[TOPLVL] Error fetching user ${userData.userId}: ${error}`);
        return {
          username: 'Nieznany użytkownik',
          level: userData.level,
          totalXP: userData.totalXp,
          rank: skip + index + 1,
          avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
        };
      }
    })
  );

  const leaderboardCard = new CanvasLeaderboardCard({
    entries: leaderboardEntries,
    guildName: guild.name,
    page: page,
    botId: interaction.client.user.id,
  });

  const cardBuffer = await leaderboardCard.build();
  const file = new AttachmentBuilder(cardBuffer, { name: 'leaderboard.png' });
  
  const content = page > 1 ? `📊 Ranking - Strona ${page} (miejsca ${skip + 1}-${skip + leaderboardEntries.length})` : undefined;
  
  await interaction.editReply({ files: [file], content });
}
