export {};

const logger = { error: jest.fn(), warn: jest.fn() };
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: logger }));

function makeMember(boosting = false) {
  const channelsCache = new Map();
  const guild = {
    id: 'g1',
    client: { user: { id: 'bot' } },
    channels: { cache: channelsCache },
  };
  const m = { 
    guild, 
    client: guild.client, 
    user: { id: 'u1' }, 
    premiumSince: boosting ? new Date() : null 
  };
  return { guild, member: m };
}

describe('guildMemberUpdate/boostDetection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends boost notification when user starts boosting', async () => {
    await jest.isolateModulesAsync(async () => {
      const sendFn = jest.fn();
      jest.doMock('../../../../src/config/guild', () => ({
        __esModule: true,
        getGuildConfig: () => ({ channels: { boostNotification: 'boostChan' }, roles: {} }),
      }));
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { boost: { thanks: ':heart:' } } }),
      }));
      const { default: run } = await import('../../../../src/events/guildMemberUpdate/boostDetection');
      const oldMember = makeMember(false).member;
      const { member: newMember } = makeMember(true);
      
      newMember.guild.channels.cache.set('boostChan', { send: sendFn });
      
      await run(oldMember as any, newMember as any);
      
      expect(sendFn).toHaveBeenCalledWith(expect.stringContaining('Dzięki za wsparcie!'));
    });
  });
});
