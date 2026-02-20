jest.mock('undici', () => ({
  fetch: jest.fn(),
}));
jest.mock('cheerio', () => ({
  load: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { fetchMeme, SITES } from '../../../src/utils/memeHelpers';
import { fetch as undiciFetch } from 'undici';
import * as cheerio from 'cheerio';

const mockFetch = undiciFetch as jest.MockedFunction<typeof undiciFetch>;

/* ── helpers ─────────────────────────────────────────── */
function htmlResponse(html: string, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    text: jest.fn().mockResolvedValue(html),
    headers: { get: jest.fn() },
  };
}
function redirectResponse(location: string): any {
  return {
    ok: false,
    status: 302,
    statusText: 'Found',
    text: jest.fn().mockResolvedValue(''),
    headers: { get: (h: string) => (h === 'location' ? location : null) },
  };
}
function jsonResponse(data: any): any {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: jest.fn().mockResolvedValue(data),
  };
}
function cheerioDoc(selectorMap: Record<string, { text?: string; attr?: Record<string, string>; length?: number }>): any {
  const $ = (selector: string) => {
    const cfg = selectorMap[selector] ?? { length: 0 };
    return {
      length: cfg.length ?? 1,
      text: () => ({ trim: () => cfg.text ?? '' }),
      attr: (key: string) => cfg.attr?.[key] ?? undefined,
    };
  };
  return $;
}

/* ── SITES config ────────────────────────────────────── */
describe('SITES', () => {
  it('exports known site keys', () => {
    expect(Object.keys(SITES)).toEqual(
      expect.arrayContaining(['kwejk', 'demotywatory', 'mistrzowie', 'ivallmemy']),
    );
  });

  it('each site has url and parser function', () => {
    for (const [, cfg] of Object.entries(SITES)) {
      expect(cfg.url).toBeTruthy();
      expect(typeof cfg.parser).toBe('function');
    }
  });
});

/* ── fetchMeme ───────────────────────────────────────── */
describe('fetchMeme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws for unknown site', async () => {
    await expect(fetchMeme('nonexistent')).rejects.toThrow('Nieznana strona');
  });

  it('returns meme data from kwejk (image)', async () => {
    const html = '<html></html>';
    mockFetch.mockResolvedValue(htmlResponse(html) as any);

    const $ = (sel: string) => {
      if (sel === '.media-element-wrapper .content h1') {
        return { text: () => ({ trim: () => 'Test Title' }), length: 1 };
      }
      if (sel === '.media-element-wrapper .figure-holder img.full-image') {
        return { length: 1, attr: (k: string) => (k === 'src' ? 'https://img.jpg' : '') };
      }
      return { length: 0 };
    };
    (cheerio.load as jest.Mock).mockReturnValue($);

    const result = await fetchMeme('kwejk');
    expect(result.title).toBe('Test Title');
    expect(result.url).toBe('https://img.jpg');
    expect(result.isVideo).toBe(false);
    expect(result.source).toBe('kwejk');
  });

  it('returns meme data from kwejk (video)', async () => {
    mockFetch.mockResolvedValue(htmlResponse('<html></html>') as any);

    const $ = (sel: string) => {
      if (sel === '.media-element-wrapper .content h1') {
        return { text: () => ({ trim: () => '' }), length: 1 };
      }
      if (sel === '.media-element-wrapper .figure-holder img.full-image') {
        return { length: 0 };
      }
      if (sel === '.video-player-box') {
        return { length: 1, attr: (k: string) => (k === 'source' ? 'https://vid.mp4' : '') };
      }
      return { length: 0 };
    };
    (cheerio.load as jest.Mock).mockReturnValue($);

    const result = await fetchMeme('kwejk');
    expect(result.url).toBe('https://vid.mp4');
    expect(result.isVideo).toBe(true);
  });

  it('rejects if kwejk has no image or video', async () => {
    mockFetch.mockResolvedValue(htmlResponse('<html></html>') as any);
    const $ = (_sel: string) => ({
      length: 0,
      text: () => ({ trim: () => '' }),
      attr: () => undefined,
    });
    (cheerio.load as jest.Mock).mockReturnValue($);

    await expect(fetchMeme('kwejk')).rejects.toThrow();
  });

  it('returns meme data from demotywatory', async () => {
    // First call → redirect
    mockFetch.mockResolvedValueOnce(redirectResponse('https://demotywatory.pl/123') as any);
    // Second call → actual page
    mockFetch.mockResolvedValueOnce(htmlResponse('<html></html>') as any);

    const $ = (sel: string) => {
      if (sel === '.demotivator h2') return { text: () => ({ trim: () => 'Demot Title' }), length: 1 };
      if (sel === 'video source[type="video/mp4"]') return { length: 0 };
      if (sel === 'img.demot') return { length: 1, attr: (k: string) => (k === 'src' ? 'https://demot.jpg' : '') };
      return { length: 0 };
    };
    (cheerio.load as jest.Mock).mockReturnValue($);

    const result = await fetchMeme('demotywatory');
    expect(result.url).toBe('https://demot.jpg');
    expect(result.source).toBe('demotywatory');
  });

  it('rejects when demotywatory has no redirect', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: () => null },
      text: jest.fn().mockResolvedValue(''),
    } as any);

    await expect(fetchMeme('demotywatory')).rejects.toThrow('Brak przekierowania');
  });

  it('returns meme data from ivallmemy', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ title: 'Ivall', url: 'https://ivall.jpg' }) as any);

    const result = await fetchMeme('ivallmemy');
    expect(result.title).toBe('Ivall');
    expect(result.url).toBe('https://ivall.jpg');
  });

  it('rejects when ivall returns no url', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ title: 'Empty' }) as any);

    await expect(fetchMeme('ivallmemy')).rejects.toThrow();
  });

  it('returns meme from mistrzowie', async () => {
    mockFetch.mockResolvedValueOnce(redirectResponse('https://mistrzowie.org/1234') as any);
    mockFetch.mockResolvedValueOnce(htmlResponse('<html></html>') as any);

    const $ = (sel: string) => {
      if (sel === '.pic_wrapper img') return { length: 1, attr: (k: string) => (k === 'src' ? '/img/123.jpg' : '') };
      if (sel === 'h1.picture') return { text: () => ({ trim: () => 'Mistrz Title' }), length: 1 };
      return { length: 0 };
    };
    (cheerio.load as jest.Mock).mockReturnValue($);

    const result = await fetchMeme('mistrzowie');
    expect(result.url).toBe('https://mistrzowie.org/img/123.jpg');
    expect(result.source).toBe('mistrzowie');
  });

  it('rejects when parser throws (HTTP error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(fetchMeme('kwejk')).rejects.toThrow('Network error');
  });
});
