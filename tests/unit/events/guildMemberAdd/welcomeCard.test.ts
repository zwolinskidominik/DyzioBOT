import run from '../../../../src/events/guildMemberAdd/welcomeCard';

const error = jest.fn();
const warn = jest.fn();
const debug = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.join? a.join(' '): a), warn: (...a:any)=>warn(a.join? a.join(' '): a), debug: (...a:any)=>debug(a.join? a.join(' '): a) } }));

jest.mock('../../../../src/config/bot', () => ({ getBotConfig: () => ({ emojis: { greetings: { hi: '👋' } } }) }));

const findOne = jest.fn();
jest.mock('../../../../src/models/GreetingsConfiguration', () => ({ GreetingsConfigurationModel: { findOne: (q:any)=> findOne(q) } }));

jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ ...o }) }));

jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  class MockEmbedBuilder {
    setColor(){return this;} setDescription(){return this;} setThumbnail(){return this;} setImage(){return this;}
  }
  return { ...actual, EmbedBuilder: MockEmbedBuilder };
});

function makeMember(channelSend?: any){
  const permissions = { has: jest.fn().mockReturnValue(true) };
  const channel = channelSend ? { send: channelSend, permissionsFor: jest.fn().mockReturnValue(permissions) } : undefined;
  const channelsCache = new Map(channel ? [[ 'greetChan', channel ]] : []);
  const botMember = { id: 'botId' };
  const membersCache = new Map([['botId', botMember]]);
  const client = { user: { id: 'botId' } };
  return {
    user: { id: 'u1', tag: 'User#0001', displayAvatarURL: ()=>'https://avatar' },
    client,
    guild: { id: 'g1', name: 'Guild', memberCount: 10, channels: { cache: channelsCache }, members: { cache: membersCache }, client },
  } as any;
}

describe('guildMemberAdd/welcomeCard', () => {
  beforeEach(()=> { findOne.mockReset(); error.mockReset(); });

  test('sends welcome card when config present', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan', welcomeEnabled: true });
    const send = jest.fn();
    const member = makeMember(send);
    await run(member);
    expect(send).toHaveBeenCalled();
  });

  test('skips when no config', async () => {
    findOne.mockResolvedValue(null);
    const send = jest.fn();
    const member = makeMember(send);
    await run(member);
    expect(send).not.toHaveBeenCalled();
  });

  test('missing target channel after config -> skip (no error)', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan', welcomeEnabled: true });
    const member = makeMember(undefined);
    await run(member);
    expect(error).not.toHaveBeenCalled();
  });

  test('bot without permissions skips send', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan', welcomeEnabled: true });
    const send = jest.fn();
    const permissions = { has: jest.fn().mockReturnValue(false) };
    const channel = { send, permissionsFor: jest.fn().mockReturnValue(permissions) };
    const channelsCache = new Map([['greetChan', channel]]);
    const botMember = { id: 'botId' };
    const membersCache = new Map([['botId', botMember]]);
    const member = {
      user: { id: 'u1', tag: 'User#0001', displayAvatarURL: ()=>'https://avatar' },
      client: { user: { id: 'botId' } },
      guild: { id: 'g1', name: 'Guild', memberCount: 10, channels: { cache: { get: (id:string)=> channelsCache.get(id) } }, members: { cache: membersCache } },
    } as any;
    await run(member);
    expect(send).not.toHaveBeenCalled();
  });

  test('channel send failure logs error but does not throw', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan', welcomeEnabled: true });
    const send = jest.fn().mockRejectedValue(new Error('send fail'));
    const member = makeMember(send);
    await run(member);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('welcomeCard.ts'));
  });
});
