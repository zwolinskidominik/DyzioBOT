import logger from '../../../../src/utils/logger';

jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

function makeModel(){
  return {
    findOne: jest.fn(()=> ({ exec: () => Promise.resolve(null) })),
    findOneAndUpdate: jest.fn(()=> ({ exec: () => Promise.resolve({}) })),
  } as any;
}

const birthdayModel = makeModel();
const twitchModel = makeModel();

jest.mock('../../../../src/models/Birthday', () => ({ BirthdayModel: birthdayModel }));
jest.mock('../../../../src/models/TwitchStreamer', () => ({ TwitchStreamerModel: twitchModel }));

let run: any;

describe('guildMemberAdd/userStatusAdd', () => {
  const memberBase = { guild: { id: 'g1' }, user: { id: 'u1' } } as any;

  beforeEach(async ()=> { jest.clearAllMocks(); (logger as any).debug.mockClear(); if(!run){ run = (await import('../../../../src/events/guildMemberAdd/userStatusAdd')).default; } });

  test('reactivates inactive entries (both models)', async () => {
    birthdayModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve({ active: false }) }));
    twitchModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve({ active: false }) }));

    await run(memberBase);

    expect(birthdayModel.findOneAndUpdate).toHaveBeenCalled();
    expect(twitchModel.findOneAndUpdate).toHaveBeenCalled();
    expect((logger as any).debug).toHaveBeenCalledTimes(2);
  });

  test('active entries unchanged', async () => {
    birthdayModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve({ active: true }) }));
    twitchModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve({ active: true }) }));

    await run(memberBase);

    expect(birthdayModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(twitchModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('no entries -> no updates', async () => {
    birthdayModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve(null) }));
    twitchModel.findOne.mockImplementation(()=> ({ exec: () => Promise.resolve(null) }));

    await run(memberBase);

    expect(birthdayModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(twitchModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('error path logs error', async () => {
    birthdayModel.findOne.mockImplementation(()=> ({ exec: () => { throw new Error('find fail'); } }));

    await run(memberBase);

    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('ponownej aktywacji wpisów'));
  });
});
