import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  type Message,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import {
  geocode,
  fetchWeather,
  fetchForecast,
  formatWeatherEmbed,
  formatForecastEmbed,
  type GeoLocation,
} from '../../utils/weatherHelpers';
import logger from '../../utils/logger';

/* ── Shared location options added to both subcommands ─────── */
function addLocationOptions(sub: any) {
  return sub
    .addStringOption((opt: any) =>
      opt
        .setName('miasto')
        .setDescription('Nazwa miasta (np. Warszawa, London, Tokyo)')
        .setRequired(true),
    );
}

export const data = new SlashCommandBuilder()
  .setName('pogoda')
  .setDescription('Sprawdź pogodę w dowolnym mieście na świecie 🌤️')
  .addSubcommand((sub) =>
    addLocationOptions(
      sub
        .setName('teraz')
        .setDescription('Aktualna pogoda w danej lokalizacji'),
    ),
  )
  .addSubcommand((sub) =>
    addLocationOptions(
      sub
        .setName('prognoza')
        .setDescription('Prognoza pogody na najbliższe 7 dni'),
    ),
  );

export const options = {
  cooldown: 5,
};

const SELECT_TIMEOUT = 30_000;

/* ── Location resolution (shared by both subcommands) ──────── */
async function resolveLocation(
  interaction: any,
  city: string,
): Promise<GeoLocation | null> {
  if (city.length < 2) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Podaj prawidłową nazwę miasta (min. 2 znaki).')],
    });
    return null;
  }

  const locations = await geocode(city);
  if (locations.length === 0) {
    await interaction.editReply({
      embeds: [createErrorEmbed(`Nie znaleziono lokalizacji **„${city}"**. Sprawdź pisownię i spróbuj ponownie.`)],
    });
    return null;
  }

  if (locations.length === 1) return locations[0];

  /* ── Disambiguation select menu ──────────────────────── */
  const customId = `pogoda_select_${interaction.id}`;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Wybierz lokalizację…')
    .addOptions(
      locations.map((loc: GeoLocation, i: number) => ({
        label: loc.admin1
          ? `${loc.name}, ${loc.admin1}`
          : loc.name,
        description: `${loc.country} (${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°)`,
        value: String(i),
      })),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const reply = await interaction.editReply({
    embeds: [
      createBaseEmbed({
        title: '📍 Znaleziono kilka lokalizacji',
        description: `Znaleziono **${locations.length}** wyników dla **„${city}"**.\nWybierz właściwą lokalizację z listy poniżej.`,
      }),
    ],
    components: [row],
  });

  try {
    const selection = await (reply as Message).awaitMessageComponent({
      filter: (i) =>
        i.customId === customId && i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
      time: SELECT_TIMEOUT,
    });

    await selection.deferUpdate();
    return locations[parseInt(selection.values[0])];
  } catch {
    await interaction.editReply({
      embeds: [createErrorEmbed('Czas na wybór lokalizacji minął. Użyj komendy ponownie.')],
      components: [],
    });
    return null;
  }
}

/* ── Main run handler ──────────────────────────────────────── */
export async function run({ interaction }: ICommandOptions): Promise<void> {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();
  const city = interaction.options.getString('miasto', true).trim();

  try {
    const location = await resolveLocation(interaction, city);
    if (!location) return;

    if (subcommand === 'teraz') {
      const weather = await fetchWeather(location.latitude, location.longitude);
      if (!weather) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Nie udało się pobrać danych pogodowych. Spróbuj ponownie później.')],
          components: [],
        });
        return;
      }

      const embed = formatWeatherEmbed(location, weather);
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      /* subcommand === 'prognoza' */
      const days = await fetchForecast(location.latitude, location.longitude);
      if (days.length === 0) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Nie udało się pobrać prognozy pogody. Spróbuj ponownie później.')],
          components: [],
        });
        return;
      }

      const embed = formatForecastEmbed(location, days);
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  } catch (error) {
    logger.error(`[pogoda] Błąd: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Wystąpił błąd podczas pobierania pogody. Spróbuj ponownie.')],
      components: [],
    });
  }
}
