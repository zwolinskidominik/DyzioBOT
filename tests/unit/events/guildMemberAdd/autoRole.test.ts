import run from '../../../../src/events/guildMemberAdd/autoRole';

const warn = jest.fn();
const error = jest.fn();
const debug = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { warn: (...a:any)=>warn(a.join? a.join(' '): a), error: (...a:any)=>error(a.join? a.join(' '): a), debug: (...a:any)=>debug(a.join? a.join(' '): a) } }));

const findOne = jest.fn();
jest.mock('../../../../src/models/AutoRole', () => ({ AutoRoleModel: { findOne: (q:any)=> findOne(q) } }));

function makeMember({ bot, roleIds}:{ bot:boolean, roleIds:string[] }) {
  const added: any[] = [];
  return {
    user: { bot, tag: 'User#0001', id: 'u1' },
    guild: { id: 'g1', name: 'Guild', roles: { cache: new Map(roleIds.map(r=> [r,{ id: r }])) } },
    roles: { add: jest.fn(async (roles:any)=> { added.push(...roles); }) },
    get added(){ return added; }
  } as any;
}

describe('guildMemberAdd/autoRole', () => {
  beforeEach(()=> { findOne.mockReset(); warn.mockReset(); error.mockReset(); debug.mockReset(); });

  test('assigns first role only to bot', async () => {
  findOne.mockResolvedValue({ roleIds: ['botRole','r2','r3'] });
    const m = makeMember({ bot: true, roleIds: ['botRole','r2','r3'] });
    await run(m);
    expect(m.roles.add).toHaveBeenCalled();
    expect(m.added.map(r=>r.id)).toEqual(['botRole']);
  });

  test('assigns remaining roles to human', async () => {
  findOne.mockResolvedValue({ roleIds: ['botRole','r2','r3'] });
    const m = makeMember({ bot: false, roleIds: ['botRole','r2','r3'] });
    await run(m);
    expect(m.added.map(r=>r.id).sort()).toEqual(['r2','r3']);
  });

  test('warns when configured roles missing in cache', async () => {
  findOne.mockResolvedValue({ roleIds: ['missing1','missing2'] });
    const m = makeMember({ bot: false, roleIds: [] });
    await run(m);
    expect(warn).toHaveBeenCalled();
  });

  test('role add error is caught and logged', async () => {
    findOne.mockResolvedValue({ roleIds: ['r1','r2'] });
    const m = makeMember({ bot: false, roleIds: ['r1','r2'] });
    (m.roles.add as any).mockImplementation(async () => { throw new Error('cannot add'); });
    await run(m);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Błąd w przypisywaniu automatycznych ról'));
  });

  test('configuration with only bot role and human user => skip (no roles) and no warn', async () => {
    findOne.mockResolvedValue({ roleIds: ['botOnly'] });
    const m = makeMember({ bot: false, roleIds: ['botOnly'] });
    await run(m);
    expect(m.roles.add).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
