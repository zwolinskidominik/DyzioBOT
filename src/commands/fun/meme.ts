import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { IMemeData } from '../../interfaces/api/Meme';
import type { ICommandOptions } from '../../interfaces/Command';
import { fetchMeme, SITES } from '../../utils/memeHelpers';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

type MemeResponse =
  | { files: { attachment: string; name: string }[]; embeds: EmbedBuilder[] }
  | { embeds: EmbedBuilder[] };

export const data = new SlashCommandBuilder()
  .setName('meme')
  .setDescription('Losuje mema z losowej strony z listy dostępnych stron');

export const options = {
  cooldown: 5,
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  try {
    const randomSite = getRandomSite();
    const meme = await fetchMeme(randomSite);

    await interaction.editReply(formatMemeResponse(meme));
  } catch (error) {
    logError(error);

    try {
      const alternativeMeme = await getAlternativeMeme();

      if (alternativeMeme) {
        await interaction.editReply(formatMemeResponse(alternativeMeme));
        return;
      }
    } catch (retryError) {
      logError(retryError, 'Błąd podczas próby pobrania mema z alternatywnej strony');
    }

    await interaction.editReply({
      content: 'Przepraszamy, nie udało się pobrać mema. Spróbuj ponownie później.',
    });
  }
}

function formatMemeResponse(meme: IMemeData): MemeResponse {
  const embed = createBaseEmbed({
    color: COLORS.MEME,
    title: meme.title || 'Random meme',
    footerText: `Źródło: ${meme.source}`,
  });

  if (meme.isVideo) {
    return {
      files: [
        {
          attachment: meme.url,
          name: 'video.mp4',
        },
      ],
      embeds: [embed],
    };
  }

  embed.setImage(meme.url);
  return { embeds: [embed] };
}

function getRandomSite(): keyof typeof SITES {
  const availableSites = Object.keys(SITES) as Array<keyof typeof SITES>;
  return availableSites[Math.floor(Math.random() * availableSites.length)];
}

async function getAlternativeMeme(): Promise<IMemeData | null> {
  const availableSites = Object.keys(SITES) as Array<keyof typeof SITES>;

  for (const site of availableSites) {
    try {
      return await fetchMeme(site);
    } catch (error) {
      logger.warn(
        `Nie udało się pobrać mema z ${site}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return null;
}

function logError(error: unknown, prefix: string = 'Błąd podczas wykonywania komendy /meme'): void {
  logger.error(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);

  if (error instanceof Error && error.stack) logger.error(error.stack);
}
