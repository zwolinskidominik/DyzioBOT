import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { xpForLevel, deltaXp } from '../../utils/levelMath';
import { getUserRank, getCurrentXp } from '../../services/xpService';
import { CanvasRankCard } from '../../utils/canvasRankCard';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Wyświetla kartę poziomu')
  .addUserOption((o) => o.setName('uzytkownik').setDescription('Domyślnie Ty').setRequired(false));

export const options = {
  guildOnly: true,
};

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const target = interaction.options.getUser('uzytkownik') ?? interaction.user;
  const gid = interaction.guildId!;
  const cachedData = await getCurrentXp(gid, target.id);
  const level = cachedData.level;
  const xp = cachedData.xp;
  const need = deltaXp(level + 1);
  const total = xpForLevel(level) + xp;
  const rankResult = await getUserRank(gid, target.id);
  const userRank = rankResult.ok ? rankResult.data.rank : 1;

  const rankCard = new CanvasRankCard({
    username: target.username,
    level: level,
    currentXP: xp,
    requiredXP: need,
    totalXP: total,
    rank: userRank,
    avatarURL: target.displayAvatarURL({ extension: 'png', size: 1024 }),
  });

  const cardBuffer = await rankCard.build();
  const file = new AttachmentBuilder(cardBuffer, { name: 'level.png' });
  await interaction.editReply({ files: [file] });
}
