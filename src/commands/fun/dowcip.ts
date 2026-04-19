import { SlashCommandBuilder } from 'discord.js';
import * as cheerio from 'cheerio';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

// ─── perelki.net (scraping losowego dowcipu) ──────────────────────────────────

async function fetchFromPerelki(): Promise<string> {
  const res = await fetch('https://perelki.net/random');
  if (!res.ok) throw new Error(`perelki.net ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const jokeEl = $('div.container').eq(1);
  jokeEl.find('.about, .cta').remove();

  const text = (jokeEl.html() ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  if (!text) throw new Error('Empty joke from perelki.net');
  return text;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('dowcip')
  .setDescription('Losowy żart!');

export const options = { cooldown: 3 };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  let text: string;

  try {
    text = await fetchFromPerelki();
  } catch (err) {
    logger.warn(`perelki.net fetch failed: ${err}`);
    await interaction.reply({
      content: '❌ Nie udało się pobrać żartu z perelki.net. Spróbuj ponownie!',
      ephemeral: true,
    });
    return;
  }

  const popcorn =
    interaction.client.user.id === '1119327417237000285'
      ? '<:pepepopcorn:1493013042009739426>'
      : '<:pepepopcorn:1493013451834920970>';

  const embed = createBaseEmbed({
    description: `${popcorn} **Losowy kawał!**\n\n${text}`,
    footerText: 'Źródło: perelki.net',
  });

  await interaction.reply({ embeds: [embed] });
}
