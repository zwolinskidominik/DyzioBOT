import { SlashCommandBuilder } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

// ─── Useless Facts API + MyMemory tłumaczenie EN → PL ────────────────────────

const FACTS_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random';

async function fetchFact(): Promise<string> {
  const factRes = await fetch(FACTS_URL);
  if (!factRes.ok) throw new Error(`uselessfacts ${factRes.status}`);
  const { text } = (await factRes.json()) as { text: string };

  const transRes = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`,
  );
  if (!transRes.ok) throw new Error(`mymemory ${transRes.status}`);
  const data = (await transRes.json()) as {
    responseStatus: number;
    responseData: { translatedText: string };
  };
  if (data.responseStatus !== 200) throw new Error(`mymemory status ${data.responseStatus}`);

  return data.responseData.translatedText;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('ciekawostka')
  .setDescription('Losowa ciekawostka!');

export const options = { cooldown: 3 };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  let text: string;

  try {
    text = await fetchFact();
  } catch (err) {
    logger.warn(`fact fetch failed: ${err}`);
    await interaction.reply({
      content: '❌ Nie udało się pobrać ciekawostki. Spróbuj ponownie!',
      ephemeral: true,
    });
    return;
  }

  const embed = createBaseEmbed({
    description: `🧠 **Czy wiesz, że...**\n\n${text}`,
    footerText: 'Źródło: uselessfacts.jsph.pl',
  });

  await interaction.reply({ embeds: [embed] });
}
