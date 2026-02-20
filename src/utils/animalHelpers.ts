import { EmbedBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { IAnimalImageResponse, IAnimalCommandConfig } from '../interfaces/api/Animal';
import { createBaseEmbed } from '../utils/embedHelpers';
import { COLORS } from '../config/constants/colors';
import logger from '../utils/logger';
import { request } from 'undici';

const lastImageId = new Map<string, string>();

export async function fetchRandomAnimalImage(
  config: IAnimalCommandConfig
): Promise<IAnimalImageResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const first = await request(config.apiURL, { signal: controller.signal });
    const json = await first.body.json();
    let arr: IAnimalImageResponse[] = Array.isArray(json) ? json : [json];
    if (!arr.length) {
      logger.warn(`API ${config.apiSource} zwróciło pustą odpowiedź.`);
      return null;
    }
    const prevId = lastImageId.get(config.apiURL);
    let chosen = arr.length > 1 ? arr.find((x) => x.id !== prevId) || arr[0] : arr[0];
    if (prevId && chosen.id === prevId) {
      try {
        const second = await request(config.apiURL, { signal: controller.signal });
        const json2 = await second.body.json();
        const arr2: IAnimalImageResponse[] = Array.isArray(json2) ? json2 : [json2];
        if (arr2.length) {
          const alt = arr2.find((x) => x.id !== prevId) || arr2[0];
          if (alt.id !== prevId) chosen = alt;
        }
      } catch {}
    }
    if (!chosen?.url) return null;
    lastImageId.set(config.apiURL, chosen.id);
    return chosen;
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    logger.error(
      `Błąd pobierania ${config.animalType} (${config.apiSource})${aborted ? ' (timeout)' : ''}: ${error}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
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
