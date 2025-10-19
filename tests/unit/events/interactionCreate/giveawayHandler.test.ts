const error = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.map(String).join(' ')) } }));

const save = jest.fn();
let giveawayDoc: any;
const findOneFn = jest.fn(async () => giveawayDoc);
jest.mock('../../../../src/models/Giveaway', () => ({ GiveawayModel: { findOne: (...a: any[]) => (findOneFn as any)(...a) } }));

import run from '../../../../src/events/interactionCreate/giveawayHandler';

jest.mock('../../../../src/config/bot', () => ({ getBotConfig: () => ({ emojis: { giveaway: { join: '🎉', list: '📜' } } }) }));

function baseInteraction(customId: string, extra: any = {}) {
  return {
    isButton: () => true,
    customId,
    guild: {
      id: 'guild1',
      members: {
        fetch: jest.fn(async (id: string) => ({ user: { username: `U_${id}` } })),
      },
    },
    user: { id: 'user1', username: 'User1' },
    member: {
      roles: { cache: new Map(extra.roleIds?.map((r:string)=> [r, { id: r }])) },
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeClient(){
  const edit = jest.fn();
  const fetch = jest.fn().mockResolvedValue({ edit });
  const channel = { messages: { fetch } };
  const guild = { channels: { cache: { get: ()=> channel } } };
  return { user: { id: 'botId' }, guilds: { cache: new Map([[ 'guild1', guild ]]) } } as any;
}

describe('interactionCreate/giveawayHandler', () => {
  beforeEach(()=> { save.mockReset(); findOneFn.mockClear(); });

  test('already joined path (duplicate)', async () => {
    giveawayDoc = { giveawayId: 'g1', guildId: 'guild1', active: true, participants: ['user1'], roleMultipliers: {}, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_join_g1');
    await run(interaction as any, makeClient());
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
  expect(save).not.toHaveBeenCalled();
  });

  test('join with multiplier roles adds multiple tickets and updates message', async () => {
    giveawayDoc = { giveawayId: 'g2', guildId: 'guild1', active: true, participants: [], roleMultipliers: { roleA: 3 }, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_join_g2', { roleIds: ['roleA'] });
    const client = makeClient();
    await run(interaction as any, client);
  expect(giveawayDoc.participants.filter((p:string)=> p==='user1').length).toBe(3);
    expect(save).toHaveBeenCalled();
  });

  test('early return when not a button or invalid customId', async () => {
    const interactionA = { ...baseInteraction('not_giveaway_format'), isButton: () => true };
    await run(interactionA as any, makeClient());
    expect(findOneFn).not.toHaveBeenCalled();

    const interactionB = { ...baseInteraction(''), isButton: () => true, customId: '' };
    await run(interactionB as any, makeClient());
    expect(findOneFn).not.toHaveBeenCalled();
  });

  test('cancel ephemeral path defers update and deletes reply', async () => {
    const interaction = baseInteraction('giveaway_cancel_ephemeral');
    await run(interaction as any, makeClient());
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(interaction.deleteReply).toHaveBeenCalled();
  });

  test('giveaway not found edits reply and returns', async () => {
    giveawayDoc = null;
    const interaction = baseInteraction('giveaway_join_missing');
    await run(interaction as any, makeClient());
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('nie został znaleziony') })
    );
  });

  test('inactive giveaway edits reply and returns', async () => {
    giveawayDoc = { giveawayId: 'g3', guildId: 'guild1', active: false, participants: [], roleMultipliers: {}, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_join_g3');
    await run(interaction as any, makeClient());
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('został już zakończony') })
    );
  });

  test('leave when not participant informs user and does not save', async () => {
    giveawayDoc = { giveawayId: 'g4', guildId: 'guild1', active: true, participants: [], roleMultipliers: {}, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_leave_g4');
    await run(interaction as any, makeClient());
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Nie jesteś zapisany') })
    );
    expect(save).not.toHaveBeenCalled();
  });

  test('leave when participant removes user and updates message', async () => {
    const edit = jest.fn();
    const fetch = jest.fn().mockResolvedValue({ edit });
    const channel = { messages: { fetch } };
    const guild = { channels: { cache: { get: ()=> channel } } };
    const client = { user: { id: 'botId' }, guilds: { cache: new Map([[ 'guild1', guild ]]) } } as any;

    giveawayDoc = { giveawayId: 'g5', guildId: 'guild1', active: true, participants: ['user1','x'], roleMultipliers: {}, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_leave_g5');
    await run(interaction as any, client);
    expect(save).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
    expect(edit).toHaveBeenCalled();
  });

  test('count action lists unique participants with pagination', async () => {
    giveawayDoc = { giveawayId: 'g6', guildId: 'guild1', active: true, participants: ['a','a','b'], roleMultipliers: {}, winnersCount: 1, save };
    const interaction = baseInteraction('giveaway_count_g6');
    await run(interaction as any, makeClient());
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
  });

  test('main error path logs and nested reply failure logs again', async () => {
    findOneFn.mockImplementationOnce(() => { throw new Error('boom'); });
    const interaction = baseInteraction('giveaway_join_err');
    (interaction.editReply as jest.Mock).mockRejectedValueOnce(new Error('reply-fail'));
    await run(interaction as any, makeClient());
    // error for main try/catch and error for nested editReply catch
    expect(error).toHaveBeenCalled();
  });
});
