jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { PermissionFlagsBits } from 'discord.js';
import run, { DEFAULT_BOT_NICKNAME } from '../../../src/events/guildCreate/setDefaultNickname';
import logger from '../../../src/utils/logger';

function makeGuild(me: { nickname: string | null; canChangeNick?: boolean; setNickname?: jest.Mock }) {
  const member = {
    nickname: me.nickname,
    permissions: {
      has: jest.fn((perm: bigint) => perm === PermissionFlagsBits.ChangeNickname && me.canChangeNick !== false),
    },
    setNickname: me.setNickname ?? jest.fn().mockResolvedValue(undefined),
  };
  return { guild: { id: 'g1', members: { me: member } }, member };
}

describe('guildCreate / setDefaultNickname', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets the "Deezy" nickname after joining a server', async () => {
    const { guild, member } = makeGuild({ nickname: null });
    await run(guild as never, {} as never);
    expect(member.setNickname).toHaveBeenCalledWith(DEFAULT_BOT_NICKNAME, expect.any(String));
    expect(DEFAULT_BOT_NICKNAME).toBe('Deezy');
  });

  it('keeps a nickname the server already set', async () => {
    const { guild, member } = makeGuild({ nickname: 'Dyzio' });
    await run(guild as never, {} as never);
    expect(member.setNickname).not.toHaveBeenCalled();
  });

  it('does nothing without the Change Nickname permission', async () => {
    const { guild, member } = makeGuild({ nickname: null, canChangeNick: false });
    await run(guild as never, {} as never);
    expect(member.setNickname).not.toHaveBeenCalled();
  });

  it('only logs a warning when Discord rejects the change', async () => {
    const { guild } = makeGuild({ nickname: null, setNickname: jest.fn().mockRejectedValue(new Error('Missing Permissions')) });
    await expect(run(guild as never, {} as never)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
