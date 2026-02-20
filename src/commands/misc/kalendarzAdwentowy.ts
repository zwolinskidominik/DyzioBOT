import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, InteractionEditReplyOptions } from 'discord.js';
import { AdventCalendarModel } from '../../models/AdventCalendar';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { modifyXp } from '../../services/xpService';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('kalendarz-adwentowy')
  .setDescription('Otwórz dzisiejsze okienko w kalendarzu adwentowym!');

export const options = {
  deleted: true,
};

interface RewardTier {
  xp: number;
  chance: number;
  label: string;
}

const REWARD_TIERS: RewardTier[] = [
  { xp: 0, chance: 50, label: 'Brak nagrody' },
  { xp: 250, chance: 25, label: '250 XP' },
  { xp: 500, chance: 12.5, label: '500 XP' },
  { xp: 1000, chance: 8, label: '1.000 XP' },
  { xp: 2000, chance: 3, label: '2.000 XP' },
  { xp: 10000, chance: 1.5, label: '10.000 XP' },
];

function getPolishTime(): Date {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const polishTime = new Date(utcTime + 3600000);
  return polishTime;
}

function getTodayDay(): number {
  const polishTime = getPolishTime();
  const year = polishTime.getFullYear();
  const month = polishTime.getMonth();
  
  if (year !== 2025 || month !== 11) {
    return -1;
  }
  
  return polishTime.getDate();
}

function getTimeUntilMidnight(): string {
  const polishTime = getPolishTime();
  const midnight = new Date(polishTime);
  midnight.setHours(24, 0, 0, 0);
  
  const diff = midnight.getTime() - polishTime.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  return `${hours}h ${minutes}m`;
}

function selectReward(): number {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const tier of REWARD_TIERS) {
    cumulative += tier.chance;
    if (random <= cumulative) {
      return tier.xp;
    }
  }
  
  return 0;
}

function getRewardChance(xp: number): number {
  const tier = REWARD_TIERS.find(t => t.xp === xp);
  return tier?.chance || 0;
}

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const today = getTodayDay();
    
    if (today === -1 || today > 24) {
      await interaction.editReply({
        embeds: [
          createBaseEmbed({
            color: COLORS.ERROR,
            description: '❌ Kalendarz adwentowy jest dostępny tylko od 1 do 24 grudnia 2025!',
            timestamp: false,
          }),
        ],
      });
      return;
    }

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    let calendar = await AdventCalendarModel.findOne({ guildId, userId });

    if (!calendar) {
      calendar = new AdventCalendarModel({
        guildId,
        userId,
        openedDays: [],
        totalXP: 0,
      });
    }

    const alreadyOpened = calendar.openedDays.find(d => d.day === today);

    if (alreadyOpened) {
      const timeUntil = getTimeUntilMidnight();
      await interaction.editReply({
        embeds: [
          createBaseEmbed({
            color: COLORS.ERROR,
            description: `❌ Już otworzyłeś/łaś okienko z dnia ${today}!\n\n⏱️ Kolejne okienko będzie dostępne za **${timeUntil}**!`,
            timestamp: false,
          }),
        ],
      });
      return;
    }

    const reward = selectReward();
    const chance = getRewardChance(reward);

    calendar.openedDays.push({
      day: today,
      xp: reward,
      openedAt: new Date(),
    });
    calendar.totalXP += reward;
    await calendar.save();

    if (reward > 0) {
      await modifyXp(interaction.client, guildId, userId, reward);
    }

    const imagePath = path.join(process.cwd(), 'assets', 'adventcalendar', `${today}.jpg`);
    let attachment: AttachmentBuilder | undefined;

    try {
      await fs.access(imagePath);
      attachment = new AttachmentBuilder(imagePath, { name: `day${today}.jpg` });
    } catch {}

    const timeUntil = getTimeUntilMidnight();

    let embed: EmbedBuilder;

    if (reward === 0) {
      embed = createBaseEmbed({
        color: COLORS.ERROR,
        description: 
          `### ❌ Cóż za pech <@${userId}>!\n` +
          `Otworzyłeś/łaś właśnie okienko z dnia **${today}**!\n\n` +
          `🎁 **Nie otrzymujesz dziś żadnej nagrody. Spróbuj swojego szczęścia jutro!**\n\n` +
          `⏱️ Kolejne okienko będzie dostępne za **${timeUntil}**!`,
        timestamp: false,
      });
    } else {
      embed = createBaseEmbed({
        color: COLORS.GIVEAWAY,
        description: 
          `### 🎉 Gratulacje <@${userId}>!\n` +
          `Otworzyłeś/łaś właśnie okienko z dnia **${today}**!\n\n` +
          `🎁 **Twoja nagroda:** ${reward.toLocaleString()} XP (${chance}% szans)\n` +
          `-# XP zostało automatycznie dodane do Twojego konta!\n\n` +
          `⏱️ Kolejne okienko będzie dostępne za **${timeUntil}**!`,
        timestamp: false,
      });
    }

    if (attachment) {
      embed.setImage(`attachment://day${today}.jpg`);
    }

    const replyOptions: InteractionEditReplyOptions = { embeds: [embed] };
    if (attachment) {
      replyOptions.files = [attachment];
    }

    await interaction.editReply(replyOptions);
  } catch (error) {
    logger.error(`[kalendarzAdwentowy] Error: ${error}`);
    await interaction.editReply({
      embeds: [
        createBaseEmbed({
          color: COLORS.ERROR,
          description: '❌ Wystąpił błąd podczas otwierania okienka.',
          timestamp: false,
        }),
      ],
    });
  }
}
