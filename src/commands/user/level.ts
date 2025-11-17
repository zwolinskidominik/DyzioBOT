import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { xpForLevel, deltaXp } from '../../utils/levelMath';
import { LevelModel } from '../../models/Level';
import xpCache from '../../cache/xpCache';
import { CanvasRankCard } from '../../utils/canvasRankCard';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Wyświetla kartę poziomu')
  .addUserOption((o) => o.setName('uzytkownik').setDescription('Domyślnie Ty').setRequired(false));

export const options = {};

async function calculateUserRank(guildId: string, userId: string): Promise<number> {
  const allUsers = await LevelModel.find({ guildId }).lean();

  const usersWithTotalXp = allUsers
    .map((user) => ({
      userId: user.userId,
      totalXp: xpForLevel(user.level) + user.xp,
    }))
    .sort((a, b) => b.totalXp - a.totalXp);

  const userRank = usersWithTotalXp.findIndex((u) => u.userId === userId) + 1;

  return userRank || 1;
}

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.inCachedGuild()) return;

  await interaction.deferReply();

  const target = interaction.options.getUser('uzytkownik') ?? interaction.user;
  const gid = interaction.guildId!;
  const cachedData = await xpCache.getCurrentXp(gid, target.id);
  const level = cachedData.level;
  const xp = cachedData.xp;
  const need = deltaXp(level + 1);
  const total = xpForLevel(level) + xp;
  const userRank = await calculateUserRank(gid, target.id);

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
