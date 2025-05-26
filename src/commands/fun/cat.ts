import { SlashCommandBuilder } from 'discord.js';
import type { IAnimalCommandConfig, IAnimalImageResponse } from '../../interfaces/api/Animal';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  fetchRandomAnimalImage,
  createAnimalEmbed,
  handleAnimalError,
} from '../../utils/animalHelpers';
import logger from '../../utils/logger';

const CAT_CONFIG: IAnimalCommandConfig = {
  apiURL: 'https://api.thecatapi.com/v1/images/search',
  animalType: 'kota',
  animalTitle: 'kotek',
  apiSource: 'thecatapi.com',
  errorMessage: 'Nie udało się pobrać zdjęcia kota. Spróbuj ponownie.',
};

export const data = new SlashCommandBuilder()
  .setName('kotek')
  .setDescription('Wysyła losowe zdjęcie kota.');

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const catData: IAnimalImageResponse | null = await fetchRandomAnimalImage(CAT_CONFIG);

    if (!catData) {
      await handleAnimalError(interaction, CAT_CONFIG);
      return;
    }

    const catEmbed = createAnimalEmbed(catData, CAT_CONFIG);
    await interaction.followUp({ embeds: [catEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas pobierania zdjęcia kota: ${error}`);
    await handleAnimalError(interaction, CAT_CONFIG);
  }
}
