import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { getFortune, DAILY_FORTUNE_LIMIT } from '../../services/fortuneService';
import logger from '../../utils/logger';
import type { ICommandConfig } from '../../interfaces/Command';

export const data = new SlashCommandBuilder()
  .setName('fortune')
  .setDescription('See what fate has in store for you today 🔮').setDescriptionLocalizations({ pl: 'Sprawdź, co los przyniósł Ci na dziś 🔮' });

/** Tylko na GameZone (serwer właściciela) i po polsku - wróżby są polskie. */
export const options: ICommandConfig = {
  cooldown: 3,
  guildOnly: true,
  restrictedGuildIds: ['881293681783623680'],
  languages: ['pl'],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const result = await getFortune({ userId: interaction.user.id });

    if (!result.ok) {
      await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
      return;
    }

    const { fortune, remainingToday } = result.data;

    const fortuneEmbed: EmbedBuilder = createBaseEmbed({
      color: COLORS.FORTUNE,
      title: '🔮 Twoja Wróżba',
      footerText: 'Limit zresetuje się o 1:00',
    }).addFields(
      {
        name: 'Przepowiednia',
        value: fortune,
      },
      {
        name: 'Pozostałe wróżby na dziś',
        value: `${remainingToday}/${DAILY_FORTUNE_LIMIT}`,
      }
    );

    await interaction.editReply({ embeds: [fortuneEmbed] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Błąd podczas wykonywania komendy /fortune: ${errorMessage}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Wystąpił błąd podczas sprawdzania wróżby. Spróbuj za chwilę.')],
    });
  }
}
