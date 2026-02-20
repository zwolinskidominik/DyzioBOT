import type { IMemeData, IMemeSourceConfig } from '../interfaces/api/Meme';
import logger from '../utils/logger';
import { fetch, Response as UndiciResponse } from 'undici';
import * as cheerio from 'cheerio';

function getDefaultHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

function wrapError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function fetchHtml(
  url: string,
  manualRedirect = false
): Promise<{ html: string; res: UndiciResponse }> {
  const res = await fetch(url, {
    headers: getDefaultHeaders(),
    redirect: manualRedirect ? 'manual' : 'follow',
  });
  if (!res.ok && !(manualRedirect && res.status >= 300 && res.status < 400)) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const html = manualRedirect ? '' : await res.text();
  return { html, res };
}

async function parseKwejkRandom(): Promise<IMemeData> {
  const { html } = await fetchHtml('https://kwejk.pl/losowy');
  const $ = cheerio.load(html);
  const title = $('.media-element-wrapper .content h1').text().trim() || 'Kwejk Meme';

  const image = $('.media-element-wrapper .figure-holder img.full-image');
  if (image.length > 0) {
    return { title, url: image.attr('src') ?? '', isVideo: false };
  }
  const videoPlayer = $('.video-player-box');
  if (videoPlayer.length > 0) {
    return { title, url: videoPlayer.attr('source') ?? '', isVideo: true };
  }
  throw new Error('Brak obrazu lub wideo na Kwejk');
}

async function parseDemotywatoryRandom(): Promise<IMemeData> {
  const { res } = await fetchHtml('https://demotywatory.pl/losuj', true);
  const redirectUrl = res.headers.get('location');
  if (!redirectUrl) throw new Error('Brak przekierowania Demotywatory');
  const { html } = await fetchHtml(redirectUrl);
  const $ = cheerio.load(html);
  const titleText = $('.demotivator h2').text().trim();
  const video = $('video source[type="video/mp4"]');
  if (video.length > 0) {
    return { title: titleText || 'Demotywatory Meme', url: video.attr('src') || '', isVideo: true };
  }
  const image = $('img.demot');
  if (image.length === 0) throw new Error('Brak obrazka na Demotywatory');
  return { title: titleText || null, url: image.attr('src') || '', isVideo: false };
}

async function parseMistrzowieRandom(): Promise<IMemeData> {
  const { res } = await fetchHtml('https://mistrzowie.org/losuj', true);
  const redirectUrl = res.headers.get('location');
  if (!redirectUrl) throw new Error('Brak przekierowania Mistrzowie');
  const { html } = await fetchHtml(redirectUrl);
  const $ = cheerio.load(html);
  const meme = $('.pic_wrapper img');
  if (!meme.length) throw new Error('Brak mema na Mistrzowie');
  return {
    title: $('h1.picture').text().trim() || 'Mistrzowie Meme',
    url: `https://mistrzowie.org${meme.attr('src') ?? ''}`,
    isVideo: false,
  };
}

async function parseIvallMemy(): Promise<IMemeData> {
  const res = await fetch('https://ivall.pl/memy', { headers: getDefaultHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { title?: string; url?: string };
  if (!data.url) throw new Error('Brak mema na ivall');
  return { title: data.title ?? null, url: data.url, isVideo: false };
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
  const siteConfig = SITES[site];
  if (!siteConfig) throw new Error(`Nieznana strona: ${site}`);
  try {
    const meme = await siteConfig.parser();
    if (!meme?.url) throw new Error(`Brak mema (${site})`);
    return { ...meme, source: site };
  } catch (error) {
    const err = wrapError(error);
    logger.error(`Błąd podczas pobierania mema z ${site}: ${err.message}`);
    return Promise.reject(err);
  }
}
