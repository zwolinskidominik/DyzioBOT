import { SlashCommandBuilder } from 'discord.js';
import type { IAnimalCommandConfig, IAnimalImageResponse } from '../../interfaces/api/Animal';
import type { ICommandOptions } from '../../interfaces/Command';
import {
  fetchRandomAnimalImage,
  createAnimalEmbed,
  handleAnimalError,
} from '../../utils/animalHelpers';
import logger from '../../utils/logger';

const DOG_CONFIG: IAnimalCommandConfig = {
  apiURL: 'https://api.thedogapi.com/v1/images/search',
  animalType: 'psa',
  animalTitle: 'piesek',
  apiSource: 'thedogapi.com',
  errorMessage: 'Nie udało się pobrać zdjęcia psa. Spróbuj ponownie.',
};

export const data = new SlashCommandBuilder()
  .setName('piesek')
  .setDescription('Wysyła losowe zdjęcie psa');

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const dogData: IAnimalImageResponse | null = await fetchRandomAnimalImage(DOG_CONFIG);

    if (!dogData) {
      await handleAnimalError(interaction, DOG_CONFIG);
      return;
    }

    const dogEmbed = createAnimalEmbed(dogData, DOG_CONFIG);
    await interaction.followUp({ embeds: [dogEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas pobierania zdjęcia psa: ${error}`);
    await handleAnimalError(interaction, DOG_CONFIG);
  }
}
