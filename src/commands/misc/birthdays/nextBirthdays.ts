import { SlashCommandBuilder, EmbedBuilder, User } from 'discord.js';
import type { ICommandOptions } from '../../../interfaces/Command';
import { getUpcomingBirthdays, getDaysForm } from '../../../services/birthdayService';
import { getBotConfig } from '../../../config/bot';
import { COLORS } from '../../../config/constants/colors';
import { createBaseEmbed } from '../../../utils/embedHelpers';
import logger from '../../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('birthdays-next')
  .setDescription('Wyświetla następne 10 urodzin użytkowników.')
  .setDMPermission(false);

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const errorEmbed: EmbedBuilder = createBaseEmbed({ isError: true });
  const successEmbed: EmbedBuilder = createBaseEmbed({ color: COLORS.BIRTHDAY });

  try {
    await interaction.deferReply();
    const guildId = interaction.guild?.id;
    const botId = interaction.client.application!.id;

    if (!guildId) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription('Ta komenda działa tylko na serwerze.')],
      });
      return;
    }

    const result = await getUpcomingBirthdays({ guildId, limit: 10 });
    if (!result.ok) {
      await interaction.editReply({
        embeds: [errorEmbed.setDescription(result.message)],
      });
      return;
    }

    const entries = result.data;
    if (entries.length === 0) {
      await interaction.editReply({
        embeds: [
          successEmbed.setDescription(
            'Brak zapisanych urodzin na tym serwerze. Użyj `/birthday-remember` aby dodać swoje!'
          ),
        ],
      });
      return;
    }

    // Resolve Discord users for display
    const displayItems: { user: User; nextBirthday: Date; age: number | null; daysUntil: number }[] = [];
    for (const entry of entries) {
      try {
        const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
        if (!user) continue;
        displayItems.push({
          user,
          nextBirthday: entry.nextBirthday,
          age: entry.age,
          daysUntil: entry.daysUntil,
        });
      } catch (err) {
        logger.warn(`Nie udało się przetworzyć urodzin użytkownika userId=${entry.userId}: ${err}`);
      }
    }

    if (displayItems.length === 0) {
      await interaction.editReply({
        embeds: [
          successEmbed.setDescription('Nie udało się znaleźć żadnych nadchodzących urodzin.'),
        ],
      });
      return;
    }

    const {
      emojis: { birthday: emoji },
    } = getBotConfig(botId);

    successEmbed
      .setTitle(`${emoji} Nadchodzące urodziny`)
      .setDescription(
        displayItems
          .map(({ user, nextBirthday, age, daysUntil }) => {
            const formattedDate = nextBirthday.toLocaleDateString('pl-PL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            const info = `${user}${age != null ? ` (${age})` : ''}`;
            if (daysUntil === 0) {
              return `**${formattedDate}** (**Dzisiaj!** ${emoji})\n${info}`;
            }
            return `**${formattedDate}** (${daysUntil} ${getDaysForm(daysUntil)})\n${info}`;
          })
          .join('\n\n')
      )
      .setFooter({
        text: `Łącznie zapisanych urodzin: ${entries.length}`,
      });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas pobierania nadchodzących urodzin: ${error}`);
    await interaction.editReply({
      embeds: [
        errorEmbed.setDescription('Wystąpił błąd podczas pobierania nadchodzących urodzin.'),
      ],
    });
  }
}
