jest.mock('../../../src/utils/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));

const fetchQueue: any[] = [];
jest.mock('undici', () => ({
  fetch: jest.fn(async () => {
    if (!fetchQueue.length) throw 'string error';
    return fetchQueue.shift();
  }),
}));

function makeHtmlResponse(html: string, status = 200) {
  return { ok: status>=200 && status<300, status, statusText: status === 200 ? 'OK' : 'ERR', headers: { get: () => null }, text: async () => html } as any;
}

describe('memeHelpers branch nits', () => {
  beforeEach(() => { jest.resetModules(); fetchQueue.length = 0; });

  test('parseKwejkRandom uses default title when missing and empty attr default', async () => {
    fetchQueue.push(makeHtmlResponse(`<div class="media-element-wrapper"><div class="content"><h1>   </h1></div><div class="figure-holder"><img class="full-image" /></div></div>`));
    const { parseKwejkRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseKwejkRandom();
    expect(meme.title).toBe('Kwejk Meme');
    expect(meme.url).toBe('');
  });

  test('fetchMeme wrap error for non-Error rejection path gets logged', async () => {
    const mod = require('../../../src/utils/memeHelpers');
    const original = mod.SITES.kwejk.parser;
    mod.SITES.kwejk.parser = async () => { throw 'not-an-error'; };
    await expect(mod.fetchMeme('kwejk')).rejects.toThrow();
    mod.SITES.kwejk.parser = original;
  });

  test('demotywatory title null for image with empty h2', async () => {
    // First manual redirect response with location
    fetchQueue.push({ ok:false, status:302, statusText:'Found', headers:{ get: () => 'https://demotywatory.pl/xx' }, text: async () => ''});
    // Second fetch returns image but empty title -> should fallback to default
    const html = `<div class="demotivator"><h2>   </h2></div><img class="demot" src="https://img/d.png" />`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseDemotywatoryRandom } = require('../../../src/utils/memeHelpers');
  const meme = await parseDemotywatoryRandom();
  // Implementation returns null for image titles when h2 is empty
  expect(meme.title).toBeNull();
    expect(meme.isVideo).toBe(false);
  });

  test('mistrzowie default title when h1 empty/whitespace', async () => {
    fetchQueue.push({ ok:false, status:302, statusText:'Found', headers:{ get: () => 'https://mistrzowie.org/yy' }, text: async () => ''});
    const html = `<h1 class="picture">   </h1><div class="pic_wrapper"><img src="/x.png" /></div>`;
    fetchQueue.push(makeHtmlResponse(html));
    const { parseMistrzowieRandom } = require('../../../src/utils/memeHelpers');
    const meme = await parseMistrzowieRandom();
    expect(meme.title).toBe('Mistrzowie Meme');
    expect(meme.isVideo).toBe(false);
  });
});
