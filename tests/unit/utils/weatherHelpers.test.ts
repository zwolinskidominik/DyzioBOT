/**
 * Unit tests for weatherHelpers — pure logic + mocked API calls.
 */

jest.mock('undici', () => ({
  request: jest.fn(),
}));

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
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C' },
}));

import {
  getWeatherInfo,
  getWeatherIconUrl,
  windDirectionLabel,
  formatWeatherEmbed,
  formatForecastEmbed,
  polishDayName,
  geocode,
  fetchForecast,
  type GeoLocation,
  type CurrentWeather,
  type DailyForecast,
} from '../../../src/utils/weatherHelpers';

import { request } from 'undici';
const mockRequest = request as jest.MockedFunction<typeof request>;

/* ── getWeatherInfo ───────────────────────────────────────── */
describe('getWeatherInfo', () => {
  it('returns sunny emoji for code 0 daytime', () => {
    const info = getWeatherInfo(0, true);
    expect(info.emoji).toBe('☀️');
    expect(info.label).toBe('Bezchmurnie');
  });

  it('returns moon emoji for code 0 nighttime', () => {
    const info = getWeatherInfo(0, false);
    expect(info.emoji).toBe('🌙');
  });

  it('returns rain emoji for code 63', () => {
    const info = getWeatherInfo(63, true);
    expect(info.emoji).toBe('🌧️');
    expect(info.label).toBe('Umiarkowany deszcz');
  });

  it('returns thunderstorm for code 95', () => {
    const info = getWeatherInfo(95, true);
    expect(info.emoji).toBe('⛈️');
    expect(info.label).toBe('Burza');
  });

  it('returns snow for code 75', () => {
    const info = getWeatherInfo(75, true);
    expect(info.emoji).toBe('❄️');
    expect(info.label).toBe('Silny śnieg');
  });

  it('returns fog for code 45', () => {
    const info = getWeatherInfo(45, true);
    expect(info.emoji).toBe('🌫️');
    expect(info.label).toBe('Mgła');
  });

  it('falls back to clear for unknown code', () => {
    const info = getWeatherInfo(999, true);
    expect(info.emoji).toBe('☀️');
  });
});

/* ── getWeatherIconUrl ─────────────────────────────────────── */
describe('getWeatherIconUrl', () => {
  it('returns OWM CDN URL for clear sky day', () => {
    const url = getWeatherIconUrl(0, true);
    expect(url).toBe('https://openweathermap.org/img/wn/01d@4x.png');
  });

  it('returns night variant for clear sky night', () => {
    const url = getWeatherIconUrl(0, false);
    expect(url).toBe('https://openweathermap.org/img/wn/01n@4x.png');
  });

  it('returns thunderstorm icon for code 95', () => {
    const url = getWeatherIconUrl(95, true);
    expect(url).toContain('11d');
  });

  it('returns snow icon for code 73', () => {
    const url = getWeatherIconUrl(73, true);
    expect(url).toContain('13d');
  });

  it('falls back to clear for unknown code', () => {
    const url = getWeatherIconUrl(999, true);
    expect(url).toContain('01d');
  });
});

/* ── windDirectionLabel ───────────────────────────────────── */
describe('windDirectionLabel', () => {
  it.each([
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
    [360, 'N'],
  ])('returns %s for %i degrees', (degrees, expected) => {
    expect(windDirectionLabel(degrees)).toBe(expected);
  });

  it('handles intermediate angles', () => {
    // 22 degrees is closer to N (0) than NE (45)
    expect(windDirectionLabel(22)).toBe('N');
    // 23 degrees rounds to NE
    expect(windDirectionLabel(23)).toBe('NE');
  });
});

/* ── formatWeatherEmbed ───────────────────────────────────── */
describe('formatWeatherEmbed', () => {
  const location: GeoLocation = {
    name: 'Warszawa',
    country: 'Polska',
    countryCode: 'PL',
    admin1: 'Mazowieckie',
    latitude: 52.23,
    longitude: 21.01,
  };

  const weather: CurrentWeather = {
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

  it('returns an embed object', () => {
    const result = formatWeatherEmbed(location, weather);
    expect(result).toBeDefined();
    expect(result.addFields).toHaveBeenCalled();
  });

  it('calls createBaseEmbed with correct title', () => {
    const { createBaseEmbed } = require('../../../src/utils/embedHelpers');
    formatWeatherEmbed(location, weather);
    expect(createBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Warszawa'),
        description: expect.stringContaining('22.5'),
      })
    );
  });

  it('handles location without admin1', () => {
    const loc = { ...location, admin1: undefined };
    const { createBaseEmbed } = require('../../../src/utils/embedHelpers');
    formatWeatherEmbed(loc, weather);
    const lastCall = createBaseEmbed.mock.calls.at(-1)[0];
    expect(lastCall.title).toContain('Warszawa');
    expect(lastCall.title).not.toContain('undefined');
  });

  it('adds 8 fields to the embed', () => {
    const embed = formatWeatherEmbed(location, weather);
    // addFields is called once with 8 field objects
    expect(embed.addFields).toHaveBeenCalledWith(
      expect.objectContaining({ name: '🌡️ Odczuwalna' }),
      expect.objectContaining({ name: '💧 Wilgotność' }),
      expect.objectContaining({ name: '☁️ Zachmurzenie' }),
      expect.objectContaining({ name: '💨 Wiatr' }),
      expect.objectContaining({ name: '🌧️ Opady' }),
      expect.objectContaining({ name: '🔵 Ciśnienie' }),
      expect.objectContaining({ name: '☀️ UV Index' }),
      expect.objectContaining({ name: '👁️ Widoczność' }),
    );
  });
});

/* ── geocode (API mocked) ─────────────────────────────────── */
describe('geocode', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockApiResponse(body: unknown) {
    mockRequest.mockResolvedValue({
      body: { json: jest.fn().mockResolvedValue(body) },
    } as any);
  }

  it('returns array of locations from Open-Meteo', async () => {
    mockApiResponse({
      results: [
        { name: 'Warszawa', country: 'Poland', country_code: 'pl', admin1: 'Mazowieckie', latitude: 52.23, longitude: 21.01 },
        { name: 'Warsaw', country: 'United States', country_code: 'us', admin1: 'Indiana', latitude: 41.34, longitude: -85.84 },
      ],
    });

    const results = await geocode('Warszawa');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Warszawa');
    expect(results[0].countryCode).toBe('PL');
    expect(results[1].name).toBe('Warsaw');
    expect(results[1].admin1).toBe('Indiana');
  });

  it('returns empty array when no results', async () => {
    mockApiResponse({});
    const results = await geocode('Nonexistentcity');
    expect(results).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNRESET'));
    const results = await geocode('Warszawa');
    expect(results).toEqual([]);
  });
});

/* ── polishDayName ────────────────────────────────────────── */
describe('polishDayName', () => {
  it.each([
    ['2026-03-02', 'poniedziałek'],
    ['2026-03-03', 'wtorek'],
    ['2026-03-04', 'środa'],
    ['2026-03-05', 'czwartek'],
    ['2026-03-06', 'piątek'],
    ['2026-03-07', 'sobota'],
    ['2026-03-08', 'niedziela'],
  ])('returns correct day name for %s', (date, expected) => {
    expect(polishDayName(date)).toBe(expected);
  });
});

/* ── fetchForecast (API mocked) ───────────────────────────── */
describe('fetchForecast', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockApiResponse(body: unknown) {
    mockRequest.mockResolvedValue({
      body: { json: jest.fn().mockResolvedValue(body) },
    } as any);
  }

  it('returns 7 days of forecast data', async () => {
    mockApiResponse({
      daily: {
        time: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'],
        weather_code: [0, 1, 2, 3, 61, 71, 95],
        temperature_2m_max: [10, 12, 8, 6, 5, 3, 7],
        temperature_2m_min: [2, 4, 1, -1, -2, -3, 0],
        precipitation_sum: [0, 0, 0.5, 1.0, 5.2, 3.1, 0],
        wind_speed_10m_max: [15, 20, 25, 30, 18, 12, 10],
        wind_gusts_10m_max: [25, 35, 40, 50, 28, 20, 15],
        uv_index_max: [3, 4, 2, 1, 1, 0.5, 2],
        sunrise: ['06:30', '06:28', '06:26', '06:24', '06:22', '06:20', '06:18'],
        sunset: ['17:30', '17:32', '17:34', '17:36', '17:38', '17:40', '17:42'],
      },
    });

    const result = await fetchForecast(52.23, 21.01);
    expect(result).toHaveLength(7);
    expect(result[0].date).toBe('2026-03-01');
    expect(result[0].tempMax).toBe(10);
    expect(result[0].tempMin).toBe(2);
    expect(result[0].weatherCode).toBe(0);
    expect(result[4].precipitationSum).toBe(5.2);
  });

  it('returns empty array when API returns no daily data', async () => {
    mockApiResponse({});
    const result = await fetchForecast(52.23, 21.01);
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNRESET'));
    const result = await fetchForecast(52.23, 21.01);
    expect(result).toEqual([]);
  });
});

/* ── formatForecastEmbed ──────────────────────────────────── */
describe('formatForecastEmbed', () => {
  const location: GeoLocation = {
    name: 'Warszawa',
    country: 'Polska',
    countryCode: 'PL',
    admin1: 'Mazowieckie',
    latitude: 52.23,
    longitude: 21.01,
  };

  const fakeDays: DailyForecast[] = [
    { date: '2026-03-01', weatherCode: 0, tempMax: 10, tempMin: 2, precipitationSum: 0, windSpeedMax: 15, windGusts: 25, uvIndexMax: 3, sunrise: '06:30', sunset: '17:30' },
    { date: '2026-03-02', weatherCode: 61, tempMax: 5, tempMin: -1, precipitationSum: 5.2, windSpeedMax: 20, windGusts: 35, uvIndexMax: 1, sunrise: '06:28', sunset: '17:32' },
  ];

  it('returns an embed object', () => {
    const result = formatForecastEmbed(location, fakeDays);
    expect(result).toBeDefined();
  });

  it('calls createBaseEmbed with forecast title', () => {
    const { createBaseEmbed } = require('../../../src/utils/embedHelpers');
    formatForecastEmbed(location, fakeDays);
    const lastCall = createBaseEmbed.mock.calls.at(-1)[0];
    expect(lastCall.title).toContain('Prognoza 7 dni');
    expect(lastCall.title).toContain('Warszawa');
  });

  it('includes day names in description', () => {
    const { createBaseEmbed } = require('../../../src/utils/embedHelpers');
    formatForecastEmbed(location, fakeDays);
    const desc = createBaseEmbed.mock.calls.at(-1)[0].description;
    expect(desc).toContain('niedziela');
    expect(desc).toContain('poniedziałek');
  });

  it('includes temperature and precipitation info', () => {
    const { createBaseEmbed } = require('../../../src/utils/embedHelpers');
    formatForecastEmbed(location, fakeDays);
    const desc = createBaseEmbed.mock.calls.at(-1)[0].description;
    expect(desc).toContain('10°');
    expect(desc).toContain('5.2 mm');
  });
});
