import { EmbedBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { IAnimalImageResponse, IAnimalCommandConfig } from '../interfaces/api/Animal';
import { createBaseEmbed } from '../utils/embedHelpers';
import { COLORS } from '../config/constants/colors';
import logger from '../utils/logger';
import { request } from 'undici';

export async function fetchRandomAnimalImage(
  config: IAnimalCommandConfig
): Promise<IAnimalImageResponse | null> {
  try {
    const result = await request(config.apiURL);
    const res = (await result.body.json()) as IAnimalImageResponse[];

    if (!res || !res.length) {
      logger.warn(`API ${config.apiSource} zwróciło pustą odpowiedź.`);
      return null;
    }

    return res[0];
  } catch (error) {
    logger.error(`Błąd podczas pobierania zdjęcia ${config.animalType}: ${error}`);
    return null;
  }
}

export function createAnimalEmbed(
  animal: IAnimalImageResponse,
  config: IAnimalCommandConfig
): EmbedBuilder {
  return createBaseEmbed({
    title: `Losowy ${config.animalTitle}`,
    footerText: `Utworzone poprzez API z ${config.apiSource} - ID: ${animal.id}`,
    image: animal.url,
    color: COLORS.DEFAULT,
  });
}

export async function handleAnimalError(
  interaction: CommandInteraction,
  config: IAnimalCommandConfig
): Promise<void> {
  await interaction.followUp({
    content: config.errorMessage,
    flags: MessageFlags.Ephemeral,
  });
}
