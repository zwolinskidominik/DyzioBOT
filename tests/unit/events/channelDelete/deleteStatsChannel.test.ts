import run from '../../../../src/events/channelDelete/deleteStatsChannel';

const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.join? a.join(' '): a) } }));

const findOneStats = jest.fn();
jest.mock('../../../../src/models/ChannelStats', () => ({ ChannelStatsModel: { findOne: (...a:any[]) => findOneStats(...a) } }));

function makeChannel(id:string, type:number, withGuild=true){
  const base:any = { id, type };
  if (withGuild) base.guild = { id: 'guild1' };
  return base;
}

const VoiceType = 2;
const TextType = 0;
const CategoryType = 4;

describe('channelDelete/deleteStatsChannel', () => {
  beforeEach(()=> { error.mockReset(); findOneStats.mockReset(); });

  test('skip when no guild', async () => {
    await run(makeChannel('c1', TextType, false) as any);
    expect(findOneStats).not.toHaveBeenCalled();
  });

  test('skip unsupported type', async () => {
    await run(makeChannel('c2', CategoryType) as any);
    expect(findOneStats).not.toHaveBeenCalled();
  });

  test('no stats doc -> skip', async () => {
    findOneStats.mockResolvedValue(null);
    await run(makeChannel('c3', TextType) as any);
  });

  test('clears matching channel reference and saves', async () => {
    const statsDoc:any = { channels: { users: { channelId: 'chanU' }, bots: { channelId: 'chanB' }, bans: { channelId: 'chanX' }, lastJoined: { channelId: 'chanL' } }, save: jest.fn(async()=>{}) };
    findOneStats.mockResolvedValue(statsDoc);
    await run(makeChannel('chanB', VoiceType) as any);
    expect(statsDoc.channels.bots.channelId).toBeUndefined();
    expect(statsDoc.save).toHaveBeenCalled();
  });

  test('error path logs error', async () => {
    findOneStats.mockRejectedValue(new Error('dbFail'));
    await run(makeChannel('c4', VoiceType) as any);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas usuwania kanału statystyk'));
  });
});
