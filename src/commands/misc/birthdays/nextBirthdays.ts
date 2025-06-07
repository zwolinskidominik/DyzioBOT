import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../../models/Birthday';
import type { IBirthday } from '../../../interfaces/Models';
import type { IUpcomingBirthday } from '../../../interfaces/Birthday';
import type { ICommandOptions } from '../../../interfaces/Command';
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

    const birthdays: BirthdayDocument[] = await BirthdayModel.find({ guildId, active: true })
      .sort({
        date: 1,
      })
      .exec();

    if (birthdays.length === 0) {
      await interaction.editReply({
        embeds: [
          successEmbed.setDescription(
            'Brak zapisanych urodzin na tym serwerze. Użyj `/birthday-remember` aby dodać swoje!'
          ),
        ],
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingBirthdays: IUpcomingBirthday[] = [];

    for (const birthday of birthdays) {
      try {
        const { userId, date, yearSpecified } = birthday as IBirthday;
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) continue;

        const birthdayDate = new Date(date);
        const nextBirthday = new Date(
          today.getFullYear(),
          birthdayDate.getMonth(),
          birthdayDate.getDate()
        );

        if (nextBirthday < today) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }

        const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const utcNextBirthday = Date.UTC(
          nextBirthday.getFullYear(),
          nextBirthday.getMonth(),
          nextBirthday.getDate()
        );

        const diffTime = utcNextBirthday - utcToday;
        const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const age = yearSpecified ? nextBirthday.getFullYear() - birthdayDate.getFullYear() : null;

        upcomingBirthdays.push({ user, date: nextBirthday, age, daysUntil });
      } catch (err) {
        logger.warn(
          `Nie udało się przetworzyć urodzin użytkownika userId=${birthday.userId}: ${err}`
        );
      }
    }

    upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    const displayBirthdays = upcomingBirthdays.slice(0, 10);

    if (displayBirthdays.length === 0) {
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
        displayBirthdays
          .map(({ user, date, age, daysUntil }) => {
            const formattedDate = date.toLocaleDateString('pl-PL', {
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
        text: `Łącznie zapisanych urodzin: ${birthdays.length}`,
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

function getDaysForm(days: number): string {
  return days === 1 ? 'dzień' : 'dni';
}
