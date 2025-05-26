import type { IMemeData, IMemeSourceConfig } from '../interfaces/api/Meme';
import logger from '../utils/logger';
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

export function getDefaultHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

export function handleFetchError(error: unknown, site: string): void {
  logger.error(`Błąd podczas pobierania mema z ${site}:`, error);
  throw error instanceof Error ? error : new Error(String(error));
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: getDefaultHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}

export async function parseKwejkRandom(): Promise<IMemeData> {
  try {
    const html = await getHtml('https://kwejk.pl/losowy');
    const $ = cheerio.load(html);

    const title = $('.media-element-wrapper .content h1').text().trim() || 'Kwejk Meme';

    const image = $('.media-element-wrapper .figure-holder img.full-image');
    if (image.length > 0) {
      return {
        title,
        url: image.attr('src') ?? '',
        isVideo: false,
      };
    }

    const videoPlayer = $('.video-player-box');
    if (videoPlayer.length > 0) {
      return {
        title,
        url: videoPlayer.attr('source') ?? '',
        isVideo: true,
      };
    }

    throw new Error('Nie udało się znaleźć obrazu lub wideo na stronie Kwejk');
  } catch (error) {
    handleFetchError(error, 'kwejk');
    throw error;
  }
}

export async function parseDemotywatoryRandom(): Promise<IMemeData> {
  try {
    const res = await fetch('https://demotywatory.pl/losuj', {
      headers: getDefaultHeaders(),
      redirect: 'manual',
    });

    const redirectUrl = res.headers.get('location');
    if (!redirectUrl) throw new Error('Brak przekierowania Demotywatory');

    const html = await getHtml(redirectUrl);
    const $ = cheerio.load(html);

    const video = $('video source[type="video/mp4"]');
    if (video.length > 0) {
      return {
        title: $('.demotivator h2').text().trim() || 'Demotywatory Meme',
        url: video.attr('src') || '',
        isVideo: true,
      };
    }

    const image = $('img.demot');
    if (image.length === 0) {
      throw new Error('Brak obrazka na Demotywatory');
    }

    return {
      title: $('.demotivator h2').text().trim() || null,
      url: image.attr('src') || '',
      isVideo: false,
    };
  } catch (error) {
    handleFetchError(error, 'demotywatory');
    throw error;
  }
}

export async function parseMistrzowieRandom(): Promise<IMemeData> {
  try {
    const res = await fetch('https://mistrzowie.org/losuj', {
      headers: getDefaultHeaders(),
      redirect: 'manual',
    });
    const redirectUrl = res.headers.get('location');
    if (!redirectUrl) throw new Error('Brak przekierowania Mistrzowie');

    const html = await getHtml(redirectUrl);
    const $ = cheerio.load(html);

    const meme = $('.pic_wrapper img');
    if (!meme.length) {
      throw new Error('Nie udało się znaleźć mema na stronie Mistrzowie');
    }

    return {
      title: $('h1.picture').text().trim() || 'Mistrzowie Meme',
      url: `https://mistrzowie.org${meme.attr('src') ?? ''}`,
      isVideo: false,
    };
  } catch (error) {
    handleFetchError(error, 'mistrzowie');
    throw error;
  }
}

export async function parseIvallMemy(): Promise<IMemeData> {
  try {
    const res = await fetch('https://ivall.pl/memy', {
      headers: getDefaultHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const data = (await res.json()) as { title?: string; url?: string };
    if (!data.url) throw new Error('Brak mema na ivall');

    return {
      title: data.title ?? null,
      url: data.url,
      isVideo: false,
    };
  } catch (error) {
    handleFetchError(error, 'ivallmemy');
    throw error;
  }
}

export const SITES: Record<string, IMemeSourceConfig> = {
  kwejk: {
    url: 'https://kwejk.pl/losowy',
    parser: parseKwejkRandom,
  },
  demotywatory: {
    url: 'https://demotywatory.pl/losuj',
    parser: parseDemotywatoryRandom,
  },
  mistrzowie: {
    url: 'https://mistrzowie.org/losuj',
    parser: parseMistrzowieRandom,
  },
  ivallmemy: {
    url: 'https://ivall.pl/memy',
    parser: parseIvallMemy,
  },
};

export async function fetchMeme(site: string): Promise<IMemeData> {
  try {
    const siteConfig = SITES[site];
    if (!siteConfig) throw new Error(`Nieznana strona: ${site}`);
    const meme = await siteConfig.parser();
    if (!meme?.url) throw new Error(`Nie udało się znaleźć mema na stronie: ${site}`);
    return { ...meme, source: site };
  } catch (error) {
    handleFetchError(error, site);
    throw error;
  }
}
