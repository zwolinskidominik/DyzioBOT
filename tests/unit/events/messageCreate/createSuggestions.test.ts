import run from '../../../../src/events/messageCreate/createSuggestions';
import logger from '../../../../src/utils/logger';

jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

type AnyMsg = any;

const findOne = jest.fn();
jest.mock('../../../../src/models/SuggestionConfiguration', () => ({ SuggestionConfigurationModel: { findOne: (...a:any[]) => findOne(...a) } }));

const createRec = jest.fn();
jest.mock('../../../../src/models/Suggestion', () => ({ SuggestionModel: { create: (...a:any[]) => createRec(...a) } }));

jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ addFields: (f:any)=> ({ ...o, fields: f }) }), formatResults: ()=> 'Za: 0 | Przeciw: 0' }));

jest.mock('../../../../src/config/bot', () => ({ getBotConfig: ()=> ({ emojis: { suggestion: { upvote: '⬆️', downvote: '⬇️' } } }) }));
jest.mock('../../../../src/config/constants/colors', () => ({ COLORS: { DEFAULT: 123 } }));

describe('messageCreate/createSuggestions', () => {
  const baseUser = { id: 'u1', bot: false, username: 'User', displayAvatarURL: ()=> 'avatar' };
  const makeMsg = (content:string, overrides:Partial<AnyMsg>={}) => {
    const channelSent: any[] = [];
    const threadCreate = jest.fn(async ()=>({ id: 'thread1' }));
    const channel = { id: 'chan1', send: jest.fn(async (p:any)=> ({ ...p, id: 'msgSug', edit: jest.fn(async ()=>({})), channel: { threads: { create: threadCreate } } })), threads: { create: threadCreate } };
    const guild = { id: 'g1' };
    const message: AnyMsg = { content, author: baseUser, client: { user: { id: 'bot1' } }, guild, channel, channelId: channel.id, delete: jest.fn(async ()=>{}) };
    Object.assign(message, overrides);
    return { message, channel, threadCreate };
  };

  beforeEach(()=> { jest.clearAllMocks(); });

  test('success: deletes message, creates record, thread and edits message', async () => {
    const { message, channel, threadCreate } = makeMsg('  jakaś sugestia  ');
    findOne.mockResolvedValue({ guildId: 'g1', suggestionChannelId: channel.id });
    createRec.mockResolvedValue({ toObject: ()=> ({ suggestionId: 'sug1' }) });

    await run(message as any);

    expect(message.delete).toHaveBeenCalled();
    expect(createRec).toHaveBeenCalledWith(expect.objectContaining({ content: 'jakaś sugestia', guildId: 'g1' }));
    expect(threadCreate).toHaveBeenCalled();
    const sendCall = channel.send.mock.results[0].value;
    const sentObj = await sendCall;
    expect(sentObj.edit).toHaveBeenCalled();
  });

  test('thread creation error logs but continues to edit', async () => {
    const { message, channel, threadCreate } = makeMsg('Sugestia testowa');
    findOne.mockResolvedValue({ guildId: 'g1', suggestionChannelId: channel.id });
    createRec.mockResolvedValue({ toObject: ()=> ({ suggestionId: 'sug2' }) });
    threadCreate.mockRejectedValue(new Error('thread fail'));

    await run(message as any);

    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Nie można utworzyć wątku'));
    const sentObj = await channel.send.mock.results[0].value;
    expect(sentObj.edit).toHaveBeenCalled();
  });

  test('no configuration -> skip (no delete)', async () => {
    const { message } = makeMsg('Sugestia bez configu');
    findOne.mockResolvedValue(null);
    await run(message as any);
    expect(message.delete).not.toHaveBeenCalled();
    expect(createRec).not.toHaveBeenCalled();
  });

  test('empty trimmed content -> skip', async () => {
    const { message } = makeMsg('   ');
    findOne.mockResolvedValue({ guildId: 'g1', suggestionChannelId: 'chan1' });
    await run(message as any);
    expect(message.delete).not.toHaveBeenCalled();
    expect(createRec).not.toHaveBeenCalled();
  });

  test('SuggestionModel.create throws -> global catch sends error message', async () => {
    const { message, channel } = makeMsg('Sugestia z błędem');
    findOne.mockResolvedValue({ guildId: 'g1', suggestionChannelId: channel.id });
    createRec.mockRejectedValue(new Error('createFail'));

    await run(message as any);

    expect(channel.send).toHaveBeenCalledTimes(2);
    const secondCallArg = channel.send.mock.calls[1][0];
    expect(secondCallArg.content).toContain('błąd');
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas tworzenia sugestii'));
  });

  test('channel without send -> logs and aborts', async () => {
    const guildId = 'g1';
    const message:any = { content: 'Sugestia', author: { id: 'u1', bot: false, username: 'User', displayAvatarURL: ()=> 'avatar' }, client: { user: { id: 'bot1' } }, guild: { id: guildId }, channelId: 'chanX', channel: { id: 'chanX' }, delete: jest.fn(async()=>{}) };
    findOne.mockResolvedValue({ guildId, suggestionChannelId: 'chanX' });

    await run(message);

    expect(message.delete).toHaveBeenCalled();
    expect(createRec).not.toHaveBeenCalled();
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Kanał nie obsługuje wysyłania wiadomości'));
  });

  test('DM or GroupDM -> shouldProcessMessage returns false (skip)', async () => {
    const { message } = makeMsg('Sugestia');
    (message as any).channel = { type: 1 };
    (message as any).guild = null;
    findOne.mockResolvedValue({});
    await run(message as any);
    expect(createRec).not.toHaveBeenCalled();
  });

  test('global catch: second channel.send also fails silently in nested try/catch', async () => {
    const { message, channel } = makeMsg('Sugestia z błędem wysyłki');
    findOne.mockResolvedValue({ guildId: 'g1', suggestionChannelId: channel.id });
    createRec.mockRejectedValue(new Error('createFail'));
    const origSend = channel.send;
    channel.send = jest.fn(async (...args:any[]) => {
      if ((channel.send as any)._calledOnce) throw new Error('fallbackFail');
      (channel.send as any)._calledOnce = true;
      return await origSend.apply(channel, args as any);
    }) as any;

    await run(message as any);
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas tworzenia sugestii'));
  });

  test('author is a bot -> shouldProcessMessage returns false (skip)', async () => {
    const { message } = makeMsg('Sugestia');
    (message as any).author = { bot: true };
    await run(message as any);
    expect(createRec).not.toHaveBeenCalled();
  });
});
