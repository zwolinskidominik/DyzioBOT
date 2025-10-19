import run from '../../../../src/events/channelDelete/deleteTempChannel';

const info = jest.fn();
const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { info: (...a:any)=>info(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a) } }));

const findOneTemp = jest.fn();
const findOneAndDeleteTemp = jest.fn();
jest.mock('../../../../src/models/TempChannelConfiguration', () => ({ TempChannelConfigurationModel: { findOne: (...a:any[]) => findOneTemp(...a), findOneAndDelete: (...a:any[]) => findOneAndDeleteTemp(...a) } }));

function makeChannel(id:string, type:number){ return { id, type, name: 'chan', } as any; }

const VoiceType = 2;
const TextType = 0;

describe('channelDelete/deleteTempChannel', () => {
  beforeEach(()=> { info.mockReset(); error.mockReset(); findOneTemp.mockReset(); findOneAndDeleteTemp.mockReset(); });

  test('skip non-voice channel', async () => {
    await run(makeChannel('c1', TextType));
    expect(findOneTemp).not.toHaveBeenCalled();
  });

  test('voice channel with config -> delete and log', async () => {
    findOneTemp.mockResolvedValue({ _id: 'x' });
    await run(makeChannel('c2', VoiceType));
    expect(findOneAndDeleteTemp).toHaveBeenCalledWith({ channelId: 'c2' });
    expect(info).toHaveBeenCalled();
  });

  test('voice channel without config -> skip', async () => {
    findOneTemp.mockResolvedValue(null);
    await run(makeChannel('c3', VoiceType));
    expect(findOneAndDeleteTemp).not.toHaveBeenCalled();
  });

  test('error path logs error', async () => {
    findOneTemp.mockRejectedValue(new Error('fail'));
    await run(makeChannel('c4', VoiceType));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas obsługi eventu channelDelete'));
  });
});
