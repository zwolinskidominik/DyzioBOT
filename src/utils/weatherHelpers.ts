/**
 * Weather helpers — Open-Meteo API (no API key required).
 *
 * Geocoding API: https://geocoding-api.open-meteo.com/v1/search
 * Weather API:   https://api.open-meteo.com/v1/forecast
 */
import { EmbedBuilder } from 'discord.js';
import { request } from 'undici';
import { createBaseEmbed } from './embedHelpers';
import logger from './logger';

/* ── Types ──────────────────────────────────────────────────── */

export interface GeoLocation {
  name: string;
  country: string;
  countryCode: string;
  admin1?: string; // region / voivodeship
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
  precipitation: number;
  cloudCover: number;
  pressure: number;
  uvIndex: number;
  visibility: number;
}

export interface DailyForecast {
  date: string;           // ISO date e.g. "2026-03-02"
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  windGusts: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

/* ── WMO weather code mapping ──────────────────────────────── */

const WMO_CODES: Record<number, { day: string; night: string; label: string }> = {
  0: { day: '☀️', night: '🌙', label: 'Bezchmurnie' },
  1: { day: '🌤️', night: '🌙', label: 'Przeważnie bezchmurnie' },
  2: { day: '⛅', night: '☁️', label: 'Częściowe zachmurzenie' },
  3: { day: '☁️', night: '☁️', label: 'Zachmurzenie całkowite' },
  45: { day: '🌫️', night: '🌫️', label: 'Mgła' },
  48: { day: '🌫️', night: '🌫️', label: 'Szadź' },
  51: { day: '🌦️', night: '🌧️', label: 'Lekka mżawka' },
  53: { day: '🌦️', night: '🌧️', label: 'Umiarkowana mżawka' },
  55: { day: '🌧️', night: '🌧️', label: 'Gęsta mżawka' },
  56: { day: '🌧️', night: '🌧️', label: 'Marznąca mżawka' },
  57: { day: '🌧️', night: '🌧️', label: 'Gęsta marznąca mżawka' },
  61: { day: '🌦️', night: '🌧️', label: 'Lekki deszcz' },
  63: { day: '🌧️', night: '🌧️', label: 'Umiarkowany deszcz' },
  65: { day: '🌧️', night: '🌧️', label: 'Silny deszcz' },
  66: { day: '🌧️', night: '🌧️', label: 'Marznący deszcz lekki' },
  67: { day: '🌧️', night: '🌧️', label: 'Marznący deszcz silny' },
  71: { day: '🌨️', night: '🌨️', label: 'Lekki śnieg' },
  73: { day: '🌨️', night: '🌨️', label: 'Umiarkowany śnieg' },
  75: { day: '❄️', night: '❄️', label: 'Silny śnieg' },
  77: { day: '❄️', night: '❄️', label: 'Ziarna śniegu' },
  80: { day: '🌦️', night: '🌧️', label: 'Lekkie przelotne opady' },
  81: { day: '🌧️', night: '🌧️', label: 'Umiarkowane przelotne opady' },
  82: { day: '⛈️', night: '⛈️', label: 'Silne przelotne opady' },
  85: { day: '🌨️', night: '🌨️', label: 'Lekkie opady śniegu' },
  86: { day: '❄️', night: '❄️', label: 'Silne opady śniegu' },
  95: { day: '⛈️', night: '⛈️', label: 'Burza' },
  96: { day: '⛈️', night: '⛈️', label: 'Burza z lekkim gradem' },
  99: { day: '⛈️', night: '⛈️', label: 'Burza z silnym gradem' },
};

export function getWeatherInfo(code: number, isDay: boolean): { emoji: string; label: string } {
  const info = WMO_CODES[code] ?? WMO_CODES[0];
  return {
    emoji: isDay ? info.day : info.night,
    label: info.label,
  };
}

/* ── Weather icon URL (OpenWeatherMap CDN) ─────────────────── */

const WMO_TO_OWM_ICON: Record<number, { day: string; night: string }> = {
  0:  { day: '01d', night: '01n' }, // clear
  1:  { day: '02d', night: '02n' }, // mainly clear
  2:  { day: '03d', night: '03n' }, // partly cloudy
  3:  { day: '04d', night: '04n' }, // overcast
  45: { day: '50d', night: '50n' }, // fog
  48: { day: '50d', night: '50n' }, // rime fog
  51: { day: '09d', night: '09n' }, // light drizzle
  53: { day: '09d', night: '09n' }, // moderate drizzle
  55: { day: '09d', night: '09n' }, // dense drizzle
  56: { day: '09d', night: '09n' }, // freezing drizzle
  57: { day: '09d', night: '09n' }, // dense freezing drizzle
  61: { day: '10d', night: '10n' }, // slight rain
  63: { day: '10d', night: '10n' }, // moderate rain
  65: { day: '09d', night: '09n' }, // heavy rain
  66: { day: '13d', night: '13n' }, // light freezing rain
  67: { day: '13d', night: '13n' }, // heavy freezing rain
  71: { day: '13d', night: '13n' }, // slight snow
  73: { day: '13d', night: '13n' }, // moderate snow
  75: { day: '13d', night: '13n' }, // heavy snow
  77: { day: '13d', night: '13n' }, // snow grains
  80: { day: '09d', night: '09n' }, // slight rain showers
  81: { day: '09d', night: '09n' }, // moderate rain showers
  82: { day: '09d', night: '09n' }, // violent rain showers
  85: { day: '13d', night: '13n' }, // slight snow showers
  86: { day: '13d', night: '13n' }, // heavy snow showers
  95: { day: '11d', night: '11n' }, // thunderstorm
  96: { day: '11d', night: '11n' }, // thunderstorm + slight hail
  99: { day: '11d', night: '11n' }, // thunderstorm + heavy hail
};

export function getWeatherIconUrl(code: number, isDay: boolean): string {
  const mapping = WMO_TO_OWM_ICON[code] ?? WMO_TO_OWM_ICON[0];
  const icon = isDay ? mapping.day : mapping.night;
  return `https://openweathermap.org/img/wn/${icon}@4x.png`;
}

/* ── Wind direction helper ─────────────────────────────────── */

export function windDirectionLabel(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return dirs[index];
}

/* ── UV Index description ──────────────────────────────────── */

function uvDescription(uv: number): string {
  if (uv <= 2) return 'Niski';
  if (uv <= 5) return 'Umiarkowany';
  if (uv <= 7) return 'Wysoki';
  if (uv <= 10) return 'Bardzo wysoki';
  return 'Ekstremalny';
}

/* ── API calls ─────────────────────────────────────────────── */

const TIMEOUT_MS = 8_000;

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

export async function geocode(query: string): Promise<GeoLocation[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=5&language=pl&format=json`;
    const res = await request(url, { signal: controller.signal });
    const json: any = await res.body.json();

    const results = json?.results;
    if (!Array.isArray(results) || results.length === 0) return [];

    return results.map((r: any) => ({
      name: r.name,
      country: r.country ?? '',
      countryCode: r.country_code?.toUpperCase() ?? '',
      admin1: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } catch (error) {
    logger.error(`[weather] Geocoding error for "${query}": ${error}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day,precipitation,cloud_cover,surface_pressure,uv_index,visibility',
      'timezone=auto',
      'wind_speed_unit=kmh',
    ].join('&');

    const url = `${WEATHER_URL}?${params}`;
    const res = await request(url, { signal: controller.signal });
    const json: any = await res.body.json();

    const c = json?.current;
    if (!c) return null;

    return {
      temperature: c.temperature_2m,
      apparentTemperature: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      windDirection: c.wind_direction_10m,
      weatherCode: c.weather_code,
      isDay: c.is_day === 1,
      precipitation: c.precipitation,
      cloudCover: c.cloud_cover,
      pressure: c.surface_pressure,
      uvIndex: c.uv_index,
      visibility: c.visibility,
    };
  } catch (error) {
    logger.error(`[weather] Fetch error (${lat}, ${lon}): ${error}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Embed builder ─────────────────────────────────────────── */

export function formatWeatherEmbed(location: GeoLocation, weather: CurrentWeather): EmbedBuilder {
  const { emoji, label } = getWeatherInfo(weather.weatherCode, weather.isDay);
  const iconUrl = getWeatherIconUrl(weather.weatherCode, weather.isDay);
  const windDir = windDirectionLabel(weather.windDirection);
  const uv = uvDescription(weather.uvIndex);

  const locationName = location.admin1
    ? `${location.name}, ${location.admin1}`
    : location.name;

  const flagEmoji = countryFlag(location.countryCode);
  const title = `${emoji} Pogoda — ${locationName} ${flagEmoji}`;

  const tempColor = weather.temperature <= 0
    ? '#5865F2' // cold blue
    : weather.temperature <= 15
      ? '#57F287' // mild green
      : weather.temperature <= 30
        ? '#FEE75C' // warm yellow
        : '#ED4245'; // hot red

  const visibilityKm = (weather.visibility / 1000).toFixed(1);

  const embed = createBaseEmbed({
    title,
    description: `### ${weather.temperature.toFixed(1)}°C · ${label}`,
    color: tempColor,
    thumbnail: iconUrl,
    footerText: `Open-Meteo · ${location.country}`,
    timestamp: true,
  });

  embed.addFields(
    {
      name: '🌡️ Odczuwalna',
      value: `${weather.apparentTemperature.toFixed(1)}°C`,
      inline: true,
    },
    {
      name: '💧 Wilgotność',
      value: `${weather.humidity}%`,
      inline: true,
    },
    {
      name: '☁️ Zachmurzenie',
      value: `${weather.cloudCover}%`,
      inline: true,
    },
    {
      name: '💨 Wiatr',
      value: `${weather.windSpeed.toFixed(1)} km/h ${windDir}\nPorywy: ${weather.windGusts.toFixed(1)} km/h`,
      inline: true,
    },
    {
      name: '🌧️ Opady',
      value: `${weather.precipitation.toFixed(1)} mm`,
      inline: true,
    },
    {
      name: '🔵 Ciśnienie',
      value: `${weather.pressure.toFixed(0)} hPa`,
      inline: true,
    },
    {
      name: '☀️ UV Index',
      value: `${weather.uvIndex.toFixed(1)} (${uv})`,
      inline: true,
    },
    {
      name: '👁️ Widoczność',
      value: `${visibilityKm} km`,
      inline: true,
    },
  );

  return embed;
}

/* ── Country flag emoji helper ─────────────────────────────── */

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const offset = 0x1F1E6 - 65; // 'A' = 65
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset,
  );
}

/* ── Daily forecast API call ───────────────────────────────── */

const FORECAST_DAYS = 7;

export async function fetchForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset`,
      `forecast_days=${FORECAST_DAYS}`,
      'timezone=auto',
      'wind_speed_unit=kmh',
    ].join('&');

    const url = `${WEATHER_URL}?${params}`;
    const res = await request(url, { signal: controller.signal });
    const json: any = await res.body.json();

    const d = json?.daily;
    if (!d || !Array.isArray(d.time)) return [];

    return d.time.map((_: string, i: number) => ({
      date: d.time[i],
      weatherCode: d.weather_code[i],
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      precipitationSum: d.precipitation_sum[i],
      windSpeedMax: d.wind_speed_10m_max[i],
      windGusts: d.wind_gusts_10m_max[i],
      uvIndexMax: d.uv_index_max[i],
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
    }));
  } catch (error) {
    logger.error(`[weather] Forecast fetch error (${lat}, ${lon}): ${error}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/* ── Forecast embed builder ────────────────────────────────── */

const PL_DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

export function polishDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return PL_DAYS[d.getDay()];
}

export function formatForecastEmbed(location: GeoLocation, days: DailyForecast[]): EmbedBuilder {
  const locationName = location.admin1
    ? `${location.name}, ${location.admin1}`
    : location.name;

  const flagEmoji = countryFlag(location.countryCode);
  const title = `📅 Prognoza 7 dni — ${locationName} ${flagEmoji}`;

  const lines = days.map((day) => {
    const { emoji, label } = getWeatherInfo(day.weatherCode, true);
    const dayName = polishDayName(day.date);
    const dateShort = day.date.slice(5); // "MM-DD"

    return [
      `${emoji} **${dayName}** (${dateShort})`,
      `🌡️ ${day.tempMax.toFixed(0)}° / ${day.tempMin.toFixed(0)}°  ·  ${label}`,
      `💨 ${day.windSpeedMax.toFixed(0)} km/h  ·  🌧️ ${day.precipitationSum.toFixed(1)} mm`,
    ].join('\n');
  });

  const embed = createBaseEmbed({
    title,
    description: lines.join('\n\n'),
    footerText: `Open-Meteo · ${location.country}`,
    timestamp: true,
  });

  return embed;
}
