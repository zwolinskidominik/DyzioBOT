import run from '../../../../src/events/voiceStateUpdate/tempChannel';
import logger from '../../../../src/utils/logger';

jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const tempConfigFind = jest.fn();
const tempChannelFindOne = jest.fn();
const tempChannelFindOneAndDelete = jest.fn();
const tempChannelSave = jest.fn();

class TempChannelDoc { constructor(public data:any){} save = tempChannelSave; }

jest.mock('../../../../src/models/TempChannelConfiguration', () => ({ TempChannelConfigurationModel: { find: (...a:any[]) => tempConfigFind(...a) } }));
jest.mock('../../../../src/models/TempChannel', () => {
  class TempChannelModelMock {
    static findOne(...a:any[]){ return tempChannelFindOne(...a); }
    static findOneAndDelete(...a:any[]){ return tempChannelFindOneAndDelete(...a); }
    public guildId!:string; public parentId!:string; public channelId!:string; public ownerId!:string;
    constructor(data:any){ Object.assign(this, data); }
    save(){ return tempChannelSave(); }
  }
  return { TempChannelModel: TempChannelModelMock };
});

function makeVoiceState(opts: Partial<any>): any {
  return {
    guild: opts.guild,
    channel: opts.channel,
    channelId: opts.channel?.id ?? null,
    member: opts.member,
    setChannel: jest.fn(async (ch:any)=> { /* moved */ })
  };
}

function makeGuild(){
  return {
    id: 'g1',
    channels: { create: jest.fn(async (options:any)=> ({ id: 'newVoice', type: 2, ...options })), cache: new Map(), },
  };
}

describe('voiceStateUpdate/tempChannel', () => {
  beforeEach(()=> { jest.clearAllMocks(); });

  test('creates temporary channel and moves user', async () => {
    const guild = makeGuild();
    const voiceTemplate = { id: 'templateVoice', name: 'Base', userLimit: 5, permissionOverwrites: { cache: [] } };
    const member = { id: 'u1' };
    const oldState = makeVoiceState({ guild, channel: null, member });
    const newState = makeVoiceState({ guild, channel: voiceTemplate, member });
    (newState as any).member = member; // ensure member
    tempConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'templateVoice' }]);
    tempChannelFindOne.mockResolvedValue(null);
    tempChannelFindOneAndDelete.mockResolvedValue(null);
    tempChannelSave.mockResolvedValue(undefined);

    await run(oldState as any, newState as any);

    expect(guild.channels.create).toHaveBeenCalled();
    expect(tempChannelSave).toHaveBeenCalled();
    expect(newState.setChannel).toHaveBeenCalled();
  });

  test('no configuration -> skip creation', async () => {
    const guild = makeGuild();
    const oldState = makeVoiceState({ guild, channel: null, member: { id: 'u1' } });
    const newState = makeVoiceState({ guild, channel: { id: 'someVoice', name: 'X', permissionOverwrites: { cache: [] } }, member: { id: 'u1' } });
    tempConfigFind.mockResolvedValue([]);

    await run(oldState, newState);

    expect(guild.channels.create).not.toHaveBeenCalled();
    expect(tempChannelSave).not.toHaveBeenCalled();
  });

  test('cleanup removes empty temp channel', async () => {
    const guild = makeGuild();
    const emptyVoice = { id: 'temp123', members: { size: 0 }, delete: jest.fn(async ()=> ({})) };
    const oldState = makeVoiceState({ guild, channel: emptyVoice, member: { id: 'u1' } });
    const newState = makeVoiceState({ guild, channel: null, member: { id: 'u1' } });
    tempConfigFind.mockResolvedValue([]);
    tempChannelFindOne.mockResolvedValue({ channelId: 'temp123' });
    tempChannelFindOneAndDelete.mockResolvedValue({});

    await run(oldState, newState);

    expect(emptyVoice.delete).toHaveBeenCalled();
    expect(tempChannelFindOneAndDelete).toHaveBeenCalledWith({ channelId: 'temp123' });
  });

  test('double cleanup deletion is noop on second call', async () => {
    const guild = makeGuild();
    const emptyVoice = { id: 'temp999', members: { size: 0 }, delete: jest.fn(async ()=> ({})) };
    const oldState = makeVoiceState({ guild, channel: emptyVoice, member: { id: 'u1' } });
    const newState = makeVoiceState({ guild, channel: null, member: { id: 'u1' } });
    tempConfigFind.mockResolvedValue([]);
    // First run: record exists
    tempChannelFindOne.mockResolvedValueOnce({ channelId: 'temp999' });
    tempChannelFindOneAndDelete.mockResolvedValueOnce({});
    await run(oldState, newState);
    expect(emptyVoice.delete).toHaveBeenCalledTimes(1);

    // Second run: record already deleted -> findOne returns null -> no deletion
    emptyVoice.delete.mockClear();
    tempChannelFindOne.mockResolvedValueOnce(null);
    await run(oldState, newState);
    expect(emptyVoice.delete).not.toHaveBeenCalled();
  });

  test('creation failure logs error after retries', async () => {
    const guild = makeGuild();
    guild.channels.create.mockRejectedValue(new Error('no perms'));
    const voiceTemplate = { id: 'templateVoice', name: 'Base', permissionOverwrites: { cache: [] } };
    const oldState = makeVoiceState({ guild, channel: null, member: { id: 'u1' } });
    const newState = makeVoiceState({ guild, channel: voiceTemplate, member: { id: 'u1' } });
    tempConfigFind.mockResolvedValue([{ guildId: 'g1', channelId: 'templateVoice' }]);

    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn:Function)=> { fn(); return 0; };
    await run(oldState, newState);
    (global as any).setTimeout = originalSetTimeout;

    expect((logger as any).warn).toHaveBeenCalled(); // retry warnings
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('voiceStateUpdate'));
  expect(tempChannelSave).not.toHaveBeenCalled(); // no DB entry created
  });

  test('deletion failure logs error', async () => {
    const guild = makeGuild();
    const emptyVoice = { id: 'temp123', members: { size: 0 }, delete: jest.fn(async ()=> { throw new Error('deny'); }) };
    const oldState = makeVoiceState({ guild, channel: emptyVoice, member: { id: 'u1' } });
    const newState = makeVoiceState({ guild, channel: null, member: { id: 'u1' } });
    tempConfigFind.mockResolvedValue([]);
    tempChannelFindOne.mockResolvedValue({ channelId: 'temp123' });

    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn:Function)=> { fn(); return 0; };
    await run(oldState, newState);
    (global as any).setTimeout = originalSetTimeout;

    expect((logger as any).warn).toHaveBeenCalled();
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('voiceStateUpdate'));
  });
});
