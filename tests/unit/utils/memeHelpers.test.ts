jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn() },
}));

const fetchQueue: any[] = [];
jest.mock('undici', () => ({
  fetch: jest.fn(async (..._args: any[]) => {
    if (!fetchQueue.length) throw new Error('fetch queue empty');
    return fetchQueue.shift();
  }),
}));

import type { IMemeData } from '../../../src/interfaces/api/Meme';

function makeHtmlResponse(html: string, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'STATUS',
    headers: {
      get: (k: string) => (headers ? headers[k.toLowerCase()] || headers[k] || null : null),
    },
    text: async () => html,
    json: async () => JSON.parse(html || '{}'),
  };
}

function makeRedirectResponse(location?: string) {
  return {
    ok: false,
    status: 302,
    statusText: 'Found',
    headers: { get: (_k: string) => location || null },
    text: async () => '',
  } as any;
}

const logger = require('../../../src/utils/logger').default;
const { fetch } = require('undici');

describe('memeHelpers parsers', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchQueue.length = 0;
    jest.clearAllMocks();
  });

  test('parseKwejkRandom image', async () => {
    const html = `<!doctype html><div class="media-element-wrapper"><div class="content"><h1>Tytuł</h1></div><div class="figure-holder"><img class="full-image" src="https://img/x.png" /></div></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    const meme: IMemeData = await parseKwejkRandom();
    expect(meme.url).toBe('https://img/x.png');
    expect(meme.isVideo).toBe(false);
  });

  test('parseKwejkRandom video fallback', async () => {
    const html = `<!doctype html><div class="media-element-wrapper"><div class="content"><h1>Tyt</h1></div><div class="video-player-box" source="https://vid/v.mp4"></div></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    const meme: IMemeData = await parseKwejkRandom();
    expect(meme.isVideo).toBe(true);
    expect(meme.url).toBe('https://vid/v.mp4');
  });

  test('parseKwejkRandom video element without source returns empty url', async () => {
    const html = `<!doctype html><div class="media-element-wrapper"><div class="content"><h1>Vid</h1></div><div class="video-player-box"></div></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    const meme: IMemeData = await parseKwejkRandom();
    expect(meme.isVideo).toBe(true);
    expect(meme.url).toBe('');
  });

  test('parseKwejkRandom error when no media', async () => {
    const html = `<!doctype html><div class="media-element-wrapper"><div class="content"><h1>X</h1></div></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseKwejkRandom()).rejects.toThrow(/Brak obrazu/);
  });

  test('parseDemotywatoryRandom missing redirect', async () => {
    fetchQueue.push(makeRedirectResponse(undefined));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseDemotywatoryRandom()).rejects.toThrow(/Brak przekierowania/);
  });

  test('parseDemotywatoryRandom video', async () => {
    fetchQueue.push(makeRedirectResponse('https://demotywatory.pl/x1'));
    const html = `<div class="demotivator"><h2>Tytuł V</h2></div><video><source type="video/mp4" src="https://vid/d.mp4" /></video>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseDemotywatoryRandom();
    expect(meme.isVideo).toBe(true);
    expect(meme.url).toMatch(/d.mp4/);
  });

  test('parseDemotywatoryRandom video with empty h2 uses default title', async () => {
    fetchQueue.push(makeRedirectResponse('https://demotywatory.pl/x1-empty'));
    const html = `<div class="demotivator"><h2>    </h2></div><video><source type="video/mp4" src="https://vid/d2.mp4" /></video>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseDemotywatoryRandom();
    expect(meme.isVideo).toBe(true);
    expect(meme.title).toBe('Demotywatory Meme');
  });

  test('parseDemotywatoryRandom image', async () => {
    fetchQueue.push(makeRedirectResponse('https://demotywatory.pl/x2'));
    const html = `<div class="demotivator"><h2>Tytuł I</h2></div><img class="demot" src="https://img/demot.png" />`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseDemotywatoryRandom();
    expect(meme.isVideo).toBe(false);
    expect(meme.url).toMatch(/demot.png/);
  });

  test('parseDemotywatoryRandom no image error', async () => {
    fetchQueue.push(makeRedirectResponse('https://demotywatory.pl/x3'));
    const html = `<div class="demotivator"><h2>Tytuł</h2></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseDemotywatoryRandom()).rejects.toThrow(/Brak obrazka/);
  });

  test('parseMistrzowieRandom missing redirect', async () => {
    fetchQueue.push(makeRedirectResponse(undefined));
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseMistrzowieRandom()).rejects.toThrow(/Brak przekierowania/);
  });

  test('parseMistrzowieRandom success', async () => {
    fetchQueue.push(makeRedirectResponse('https://mistrzowie.org/x4'));
    const html = `<h1 class="picture">Tytuł M</h1><div class="pic_wrapper"><img src="/media/img1.png" /></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseMistrzowieRandom();
    expect(meme.url).toMatch(/mistrzowie.org/);
    expect(meme.isVideo).toBe(false);
  });

  test('parseMistrzowieRandom no img error', async () => {
    fetchQueue.push(makeRedirectResponse('https://mistrzowie.org/x5'));
    const html = `<h1 class="picture">T</h1>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseMistrzowieRandom()).rejects.toThrow(/Brak mema/);
  });

  test('parseIvallMemy success', async () => {
    const json = JSON.stringify({ title: 'IV', url: 'https://iv/img.png' });
    fetchQueue.push({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => JSON.parse(json),
    });
    const { parseIvallMemy } = require('../../../src/utils/memeHelpers');
    const meme = await parseIvallMemy();
    expect(meme.url).toContain('iv');
  });

  test('parseIvallMemy HTTP fail', async () => {
    fetchQueue.push({
      ok: false,
      status: 500,
      statusText: 'ERR',
      headers: { get: () => null },
      json: async () => ({}),
    });
    const { parseIvallMemy } = require('../../../src/utils/memeHelpers');
    await expect(parseIvallMemy()).rejects.toThrow(/HTTP 500/);
  });

  test('parseIvallMemy invalid JSON throws', async () => {
    fetchQueue.push({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => { throw new SyntaxError('Invalid JSON'); },
    });
    const { parseIvallMemy } = require('../../../src/utils/memeHelpers');
    await expect(parseIvallMemy()).rejects.toThrow(/invalid json|syntaxerror/i);
  });

  test('parseIvallMemy empty array treated as missing url', async () => {
    fetchQueue.push({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ([]),
    });
    const { parseIvallMemy } = require('../../../src/utils/memeHelpers');
    await expect(parseIvallMemy()).rejects.toThrow(/Brak mema|url/i);
  });

  test('parseIvallMemy missing url', async () => {
    fetchQueue.push({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ title: 'X' }),
    });
    const { parseIvallMemy } = require('../../../src/utils/memeHelpers');
    await expect(parseIvallMemy()).rejects.toThrow(/Brak mema/);
  });
});

describe('memeHelpers fetchMeme', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchQueue.length = 0;
    jest.clearAllMocks();
  });

  test('unknown site rejects', async () => {
    const { fetchMeme } = require('../../../src/utils/memeHelpers');
    await expect(fetchMeme('xxx')).rejects.toThrow(/Nieznana strona/);
  });

  test('fetchMeme success adds source', async () => {
    const html = `<!doctype html><div class=\"media-element-wrapper\"><div class=\"content\"><h1>Ok</h1></div><div class=\"figure-holder\"><img class=\"full-image\" src=\"https://img/k.png\" /></div></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { fetchMeme } = require('../../../src/utils/memeHelpers');
    const meme = await fetchMeme('kwejk');
    expect(meme.source).toBe('kwejk');
    expect(meme.url).toContain('k.png');
  });

  test('fetchMeme propagates empty url as error & logs', async () => {
    const mod = require('../../../src/utils/memeHelpers');
    const original = mod.SITES.kwejk.parser;
    mod.SITES.kwejk.parser = async () => ({ title: null, url: '', isVideo: false });
    await expect(mod.fetchMeme('kwejk')).rejects.toThrow(/Brak mema/);
    const dynLogger = require('../../../src/utils/logger').default;
    expect(dynLogger.error).toHaveBeenCalled();
    mod.SITES.kwejk.parser = original;
  });

  test('fetchMeme logs when parser throws', async () => {
    const mod = require('../../../src/utils/memeHelpers');
    const original = mod.SITES.mistrzowie.parser;
    mod.SITES.mistrzowie.parser = async () => { throw new Error('fail custom'); };
    await expect(mod.fetchMeme('mistrzowie')).rejects.toThrow(/fail custom/);
    const dynLogger = require('../../../src/utils/logger').default;
    expect(dynLogger.error).toHaveBeenCalled();
    mod.SITES.mistrzowie.parser = original;
  });

  test('parseKwejkRandom HTTP 500 propagates error', async () => {
    fetchQueue.push({
      ok: false,
      status: 500,
      statusText: 'ERR',
      headers: { get: () => null },
      text: async () => '',
    });
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseKwejkRandom()).rejects.toThrow(/HTTP 500/);
  });

  test('fetchHtml manual redirect unhappy path: demotywatory/mistrzowie 3xx without location', async () => {
    fetchQueue.push({ ok: false, status: 302, statusText: 'Found', headers: { get: () => null }, text: async () => '' });
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseDemotywatoryRandom()).rejects.toThrow(/Brak przekierowania/);

    fetchQueue.push({ ok: false, status: 301, statusText: 'Moved', headers: { get: () => null }, text: async () => '' });
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseMistrzowieRandom()).rejects.toThrow(/Brak przekierowania/);
  });

  test('kwejk unexpected status triggers HTTP error', async () => {
    fetchQueue.push({ ok: false, status: 403, statusText: 'Forbidden', headers: { get: () => null }, text: async () => '' });
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseKwejkRandom()).rejects.toThrow(/HTTP 403/);
  });

  test('demotywatory unexpected status on second fetch triggers error', async () => {
    fetchQueue.push(makeRedirectResponse('https://demotywatory.pl/x-err'));
    fetchQueue.push({ ok: false, status: 500, statusText: 'ERR', headers: { get: () => null }, text: async () => '' });
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseDemotywatoryRandom()).rejects.toThrow(/HTTP 500/);
  });

  test('mistrzowie unexpected status on second fetch triggers error', async () => {
    fetchQueue.push(makeRedirectResponse('https://mistrzowie.org/x-err'));
    fetchQueue.push({ ok: false, status: 404, statusText: 'NF', headers: { get: () => null }, text: async () => '' });
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    await expect(parseMistrzowieRandom()).rejects.toThrow(/HTTP 404/);
  });
});
