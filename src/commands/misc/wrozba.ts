import { SlashCommandBuilder, User, EmbedBuilder } from 'discord.js';
import { FortuneModel, FortuneUsageModel, FortuneUsageDocument } from '../../models/Fortune';
import type { ICommandOptions } from '../../interfaces/Command';
import type { IFortune } from '../../interfaces/Models';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('wrozba')
  .setDescription('Sprawdź swoją wróżbę na dziś');

export const options = {
  deleted: true,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const user: User = interaction.user;
    const now: Date = new Date();
    const today: Date = new Date();
    today.setHours(0, 0, 0, 0);

    const fortunes: IFortune[] = await FortuneModel.find<IFortune>().lean().exec();
    if (!fortunes.length) {
      logger.warn('Brak wróżb w bazie. Nie można wyświetlić /wrozba');
      await interaction.editReply({
        content: 'Brak wróżb w bazie danych! Skontaktuj się z administratorem.',
      });
      return;
    }

    let usage = (await FortuneUsageModel.findOne({
      userId: user.id,
      targetId: user.id,
    }).exec()) as FortuneUsageDocument | null;

    if (!usage) {
      usage = new FortuneUsageModel({
        userId: user.id,
        targetId: user.id,
        lastUsedDay: today,
        dailyUsageCount: 0,
      }) as FortuneUsageDocument;
    }

    const lastUsedDay = new Date(usage.lastUsedDay);
    lastUsedDay.setHours(0, 0, 0, 0);

    if (today.getTime() > lastUsedDay.getTime()) {
      usage.dailyUsageCount = 0;
      usage.lastUsedDay = today;
    }

    if (usage.dailyUsageCount >= 2) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const msUntil: number = tomorrow.getTime() - now.getTime();
      const h: number = Math.floor(msUntil / (1000 * 60 * 60));
      const m: number = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));

      await interaction.editReply({
        content: `Wykorzystałeś już limit wróżb na dzisiaj! Następne wróżby będą dostępne za ${h}h i ${m} min.`,
      });
      return;
    }

    const random: IFortune = fortunes[Math.floor(Math.random() * fortunes.length)];

    usage.dailyUsageCount += 1;
    usage.lastUsed = now;
    await usage.save();

    await FortuneModel.deleteOne({ content: random.content }).exec();

    const fortuneEmbed: EmbedBuilder = createBaseEmbed({
      color: COLORS.FORTUNE,
      title: '🔮 Twoja Wróżba',
      footerText: 'Limit zresetuje się o 1:00',
    }).addFields(
      {
        name: 'Przepowiednia',
        value: random.content || 'Brak przepowiedni',
      },
      {
        name: 'Pozostałe wróżby na dziś',
        value: `${2 - usage.dailyUsageCount}/2`,
      }
    );

    await interaction.editReply({ embeds: [fortuneEmbed] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas wykonywania komendy /wrozba: ${errorMessage}`);
    await interaction.editReply({
      content: `Wystąpił błąd podczas sprawdzania wróżby: ${errorMessage}`,
    });
  }
}
