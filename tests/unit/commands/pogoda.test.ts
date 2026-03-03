/**
 * Unit tests for /pogoda command (subcommands: teraz, prognoza).
 */

/* ── Mock external dependencies ────────────────────────────── */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    addFields: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({ _error: true }),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C' },
}));

jest.mock('../../../src/utils/weatherHelpers');

import { mockInteraction } from '../../helpers/discordMocks';
import {
  geocode,
  fetchWeather,
  fetchForecast,
  formatWeatherEmbed,
  formatForecastEmbed,
} from '../../../src/utils/weatherHelpers';

const mockGeocode = geocode as jest.MockedFunction<typeof geocode>;
const mockFetchWeather = fetchWeather as jest.MockedFunction<typeof fetchWeather>;
const mockFetchForecast = fetchForecast as jest.MockedFunction<typeof fetchForecast>;
const mockFormat = formatWeatherEmbed as jest.MockedFunction<typeof formatWeatherEmbed>;
const mockFormatForecast = formatForecastEmbed as jest.MockedFunction<typeof formatForecastEmbed>;

const fakeLocation = {
  name: 'Warszawa',
  country: 'Polska',
  countryCode: 'PL',
  admin1: 'Mazowieckie',
  latitude: 52.23,
  longitude: 21.01,
};

const fakeLocation2 = {
  name: 'Warsaw',
  country: 'United States',
  countryCode: 'US',
  admin1: 'Indiana',
  latitude: 41.34,
  longitude: -85.84,
};

const fakeWeather = {
  temperature: 22.5,
  apparentTemperature: 21.0,
  humidity: 65,
  windSpeed: 12.3,
  windGusts: 18.5,
  windDirection: 180,
  weatherCode: 2,
  isDay: true,
  precipitation: 0.0,
  cloudCover: 50,
  pressure: 1013,
  uvIndex: 5.2,
  visibility: 24000,
};

const fakeEmbed = { _embed: true } as any;
const fakeForecastEmbed = { _forecastEmbed: true } as any;

const fakeForecastDays = [
  { date: '2026-03-01', weatherCode: 0, tempMax: 10, tempMin: 2, precipitationSum: 0, windSpeedMax: 15, windGusts: 25, uvIndexMax: 3, sunrise: '06:30', sunset: '17:30' },
  { date: '2026-03-02', weatherCode: 61, tempMax: 5, tempMin: -1, precipitationSum: 5.2, windSpeedMax: 20, windGusts: 35, uvIndexMax: 1, sunrise: '06:28', sunset: '17:32' },
];

/* ── Helper ────────────────────────────────────────────────── */
function buildInteraction(opts: Record<string, unknown> = {}, subcommand = 'teraz') {
  const mockAwait = jest.fn();
  const interaction = mockInteraction({ _options: { _subcommand: subcommand, ...opts } });

  // editReply returns a message-like with awaitMessageComponent
  interaction.editReply = jest.fn().mockResolvedValue({
    id: 'edit-msg',
    awaitMessageComponent: mockAwait,
  });

  return { interaction, mockAwait };
}

/* ── Tests ─────────────────────────────────────────────────── */
describe('/pogoda command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeocode.mockResolvedValue([fakeLocation]);
    mockFetchWeather.mockResolvedValue(fakeWeather);
    mockFetchForecast.mockResolvedValue(fakeForecastDays);
    mockFormat.mockReturnValue(fakeEmbed);
    mockFormatForecast.mockReturnValue(fakeForecastEmbed);
  });

  /* ── data export ─────────────────────────────────────────── */
  it('exports correct command name', () => {
    const { data } = require('../../../src/commands/fun/pogoda');
    expect(data.name).toBe('pogoda');
  });

  it('has "teraz" and "prognoza" subcommands', () => {
    const { data } = require('../../../src/commands/fun/pogoda');
    const names = data.options.map((o: any) => o.name);
    expect(names).toContain('teraz');
    expect(names).toContain('prognoza');
  });

  it('both subcommands have required "miasto" option', () => {
    const { data } = require('../../../src/commands/fun/pogoda');
    for (const sub of data.options) {
      const miasto = sub.options?.find((o: any) => o.name === 'miasto');
      expect(miasto).toBeDefined();
      expect(miasto.required).toBe(true);
    }
  });

  it('has a cooldown of 5 seconds', () => {
    const { options } = require('../../../src/commands/fun/pogoda');
    expect(options.cooldown).toBe(5);
  });

  /* ── run – single city result ────────────────────────────── */
  it('defers reply and sends weather embed on success', async () => {
    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Warszawa' });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGeocode).toHaveBeenCalledWith('Warszawa');
    expect(mockFetchWeather).toHaveBeenCalledWith(52.23, 21.01);
    expect(mockFormat).toHaveBeenCalledWith(fakeLocation, fakeWeather);
    expect(interaction.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ embeds: [fakeEmbed] }),
    );
  });

  /* ── run – city too short ────────────────────────────────── */
  it('sends error for city name shorter than 2 chars', async () => {
    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'X' });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  /* ── run – geocode empty ─────────────────────────────────── */
  it('sends error when geocode returns empty array', async () => {
    mockGeocode.mockResolvedValue([]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Nonexistentcity' });

    await run({ interaction, client: interaction.client });

    expect(mockGeocode).toHaveBeenCalledWith('Nonexistentcity');
    expect(mockFetchWeather).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  /* ── run – weather fetch fails ───────────────────────────── */
  it('sends error when fetchWeather returns null', async () => {
    mockFetchWeather.mockResolvedValue(null);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Warszawa' });

    await run({ interaction, client: interaction.client });

    expect(mockGeocode).toHaveBeenCalled();
    expect(mockFetchWeather).toHaveBeenCalled();
    expect(mockFormat).not.toHaveBeenCalled();
  });

  /* ── run – unexpected exception ──────────────────────────── */
  it('catches unexpected errors and replies with error embed', async () => {
    mockGeocode.mockRejectedValue(new Error('network fail'));

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Warszawa' });

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  /* ── run – trims whitespace ──────────────────────────────── */
  it('trims city name whitespace', async () => {
    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: '  Kraków  ' });

    await run({ interaction, client: interaction.client });

    expect(mockGeocode).toHaveBeenCalledWith('Kraków');
  });

  /* ── run – disambiguation (multiple results) ─────────────── */
  it('shows select menu when geocode returns multiple results', async () => {
    mockGeocode.mockResolvedValue([fakeLocation, fakeLocation2]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction, mockAwait } = buildInteraction({ miasto: 'Warsaw' });

    mockAwait.mockResolvedValue({
      values: ['0'],
      deferUpdate: jest.fn(),
      user: { id: interaction.user.id },
    });

    await run({ interaction, client: interaction.client });

    // First editReply = select menu with components
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.arrayContaining([expect.any(Object)]),
      }),
    );
    // After selection → fetches weather for first location
    expect(mockFetchWeather).toHaveBeenCalledWith(52.23, 21.01);
    expect(interaction.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ embeds: [fakeEmbed] }),
    );
  });

  it('user picks second location from disambiguation', async () => {
    mockGeocode.mockResolvedValue([fakeLocation, fakeLocation2]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction, mockAwait } = buildInteraction({ miasto: 'Warsaw' });

    mockAwait.mockResolvedValue({
      values: ['1'],
      deferUpdate: jest.fn(),
      user: { id: interaction.user.id },
    });

    await run({ interaction, client: interaction.client });

    expect(mockFetchWeather).toHaveBeenCalledWith(41.34, -85.84);
  });

  it('sends timeout error when user does not pick from select', async () => {
    mockGeocode.mockResolvedValue([fakeLocation, fakeLocation2]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction, mockAwait } = buildInteraction({ miasto: 'Warsaw' });

    mockAwait.mockRejectedValue(new Error('Collector timed out'));

    await run({ interaction, client: interaction.client });

    expect(mockFetchWeather).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: [],
      }),
    );
  });

  /* ═════════════════════════════════════════════════════════ */
  /* ── /pogoda prognoza ────────────────────────────────────── */
  /* ═════════════════════════════════════════════════════════ */

  it('prognoza: fetches forecast and sends forecast embed', async () => {
    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Warszawa' }, 'prognoza');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGeocode).toHaveBeenCalledWith('Warszawa');
    expect(mockFetchForecast).toHaveBeenCalledWith(52.23, 21.01);
    expect(mockFetchWeather).not.toHaveBeenCalled();
    expect(mockFormatForecast).toHaveBeenCalledWith(fakeLocation, fakeForecastDays);
    expect(interaction.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ embeds: [fakeForecastEmbed] }),
    );
  });

  it('prognoza: sends error when fetchForecast returns empty', async () => {
    mockFetchForecast.mockResolvedValue([]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction } = buildInteraction({ miasto: 'Warszawa' }, 'prognoza');

    await run({ interaction, client: interaction.client });

    expect(mockFetchForecast).toHaveBeenCalled();
    expect(mockFormatForecast).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('prognoza: disambiguation works for forecast too', async () => {
    mockGeocode.mockResolvedValue([fakeLocation, fakeLocation2]);

    const { run } = require('../../../src/commands/fun/pogoda');
    const { interaction, mockAwait } = buildInteraction({ miasto: 'Warsaw' }, 'prognoza');

    mockAwait.mockResolvedValue({
      values: ['1'],
      deferUpdate: jest.fn(),
      user: { id: interaction.user.id },
    });

    await run({ interaction, client: interaction.client });

    expect(mockFetchForecast).toHaveBeenCalledWith(41.34, -85.84);
  });
});
