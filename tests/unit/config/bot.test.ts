import { getBotConfig } from '../../../src/config/bot';

describe('getBotConfig', () => {
  it('returns main bot config for known bot ID', () => {
    const cfg = getBotConfig('1119327417237000285');
    expect(cfg.emojis.birthday).toContain('bday');
    expect(cfg.emojis.next).toContain('Next');
  });

  it('returns test bot config for test bot ID', () => {
    const cfg = getBotConfig('1248419676740915310');
    expect(cfg.emojis.birthday).toContain('bday');
  });

  it('returns test bot (fallback) for unknown bot ID', () => {
    const cfg = getBotConfig('unknown-id-999');
    const test = getBotConfig('1248419676740915310');
    expect(cfg).toEqual(test);
  });

  it('config has expected emoji structure', () => {
    const cfg = getBotConfig('1119327417237000285');
    expect(cfg.emojis.boost.list).toBeTruthy();
    expect(cfg.emojis.boost.thanks).toBeTruthy();
    expect(cfg.emojis.faceit.levels[1]).toBeTruthy();
    expect(cfg.emojis.faceit.levels[10]).toBeTruthy();
    expect(cfg.emojis.giveaway.join).toBeTruthy();
    expect(cfg.emojis.greetings.hi).toBeTruthy();
    expect(cfg.emojis.suggestion.upvote).toBeTruthy();
    expect(cfg.emojis.trophy.gold).toBeTruthy();
    expect(cfg.emojis.warnPB.le).toBeTruthy();
    expect(cfg.emojis.suggestionPB.le).toBeTruthy();
  });
});
