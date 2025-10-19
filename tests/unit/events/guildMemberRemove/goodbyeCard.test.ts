import run from '../../../../src/events/guildMemberRemove/goodbyeCard';

const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.join? a.join(' '): a) } }));
jest.mock('../../../../src/config/bot', () => ({ getBotConfig: () => ({ emojis: { greetings: { bye: '👋' } } }) }));

const findOne = jest.fn();
jest.mock('../../../../src/models/GreetingsConfiguration', () => ({ GreetingsConfigurationModel: { findOne: (q:any)=> findOne(q) } }));

const build = jest.fn();
jest.mock('canvacord', () => ({ Font: { loadDefault: jest.fn(async()=>{}) } }));
jest.mock('../../../../src/utils/cardHelpers', () => ({ GreetingsCard: class { setAvatar(){return this;} setDisplayName(){return this;} setType(){return this;} setMessage(){return this;} build(){ return build(); } } }));
jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ ...o }) }));

function makeMember(channelSend?: any){
  const channel = channelSend ? { send: channelSend } : undefined;
  const channelsCache = new Map(channel ? [[ 'greetChan', channel ]] : []);
  return {
    user: { id: 'u1', tag: 'User#0001', displayAvatarURL: ()=>'https://avatar' },
    client: { user: { id: 'botId' } },
    guild: { id: 'g1', name: 'Guild', channels: { cache: { get: (id:string)=> channelsCache.get(id) } } },
  } as any;
}

describe('guildMemberRemove/goodbyeCard', () => {
  beforeEach(()=> { findOne.mockReset(); error.mockReset(); build.mockReset(); });

  test('sends goodbye card', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan' });
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
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan' });
    const member = makeMember(undefined);
    await run(member);
    expect(error).not.toHaveBeenCalled();
  });

  test('card build failure logs error but does not throw', async () => {
    findOne.mockResolvedValue({ greetingsChannelId: 'greetChan' });
    build.mockRejectedValue(new Error('build fail'));
    const send = jest.fn();
    const member = makeMember(send);
    await run(member);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('goodbyeCard.ts'));
  });
});
