jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

const mockFindOne = jest.fn();
jest.mock('../../../src/models/CommandConfig', () => ({
  CommandConfigModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

import commandToggle from '../../../src/validations/commandToggle';
import type { ICommand } from '../../../src/interfaces/Command';

function makeCommand(name: string, category?: string): ICommand {
  return {
    data: { name } as unknown as ICommand['data'],
    run: jest.fn(),
    category,
  };
}

function makeInteraction(guildId: string | null) {
  return { guildId } as any;
}

describe('commandToggle', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
  });

  it('allows commands outside fun/misc without touching the database', async () => {
    const result = await commandToggle(makeInteraction('g1'), makeCommand('ban', 'moderation'));
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('allows commands with no category set', async () => {
    const result = await commandToggle(makeInteraction('g1'), makeCommand('ban'));
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('allows DM usage (no guildId) without touching the database', async () => {
    const result = await commandToggle(makeInteraction(null), makeCommand('meme', 'fun'));
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('allows the command when no config document exists (opt-out default)', async () => {
    mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const result = await commandToggle(makeInteraction('g1'), makeCommand('meme', 'fun'));
    expect(result).toBeNull();
    expect(mockFindOne).toHaveBeenCalledWith({ guildId: 'g1' });
  });

  it('blocks all utility commands when the module is disabled', async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ guildId: 'g1', enabled: false, disabledCommands: [] }),
    });
    const result = await commandToggle(makeInteraction('g1'), makeCommand('meme', 'fun'));
    expect(result).toBe('🔧 Moduł Narzędzia jest wyłączony na tym serwerze.');
  });

  it('blocks an individually disabled command', async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ guildId: 'g1', enabled: true, disabledCommands: ['meme'] }),
    });
    const result = await commandToggle(makeInteraction('g1'), makeCommand('meme', 'fun'));
    expect(result).toBe('🔧 Ta komenda jest wyłączona na tym serwerze.');
  });

  it('allows a command not present in disabledCommands', async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ guildId: 'g1', enabled: true, disabledCommands: ['dowcip'] }),
    });
    const result = await commandToggle(makeInteraction('g1'), makeCommand('meme', 'fun'));
    expect(result).toBeNull();
  });

  it('fails open (returns null) when the database throws', async () => {
    mockFindOne.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('db down')) });
    const result = await commandToggle(makeInteraction('g1'), makeCommand('meme', 'fun'));
    expect(result).toBeNull();
  });

  describe('additional utility commands (say/role/emoji-steal, category "admin")', () => {
    it.each(['say', 'role', 'emoji-steal'])(
      'checks the utility config for "%s" despite its category being "admin"',
      async (name) => {
        mockFindOne.mockReturnValue({
          lean: jest.fn().mockResolvedValue({ guildId: 'g1', enabled: false, disabledCommands: [] }),
        });
        const result = await commandToggle(makeInteraction('g1'), makeCommand(name, 'admin'));
        expect(result).toBe('🔧 Moduł Narzędzia jest wyłączony na tym serwerze.');
        expect(mockFindOne).toHaveBeenCalledWith({ guildId: 'g1' });
      }
    );

    it('does not touch the database for other admin commands (e.g. giveaway, xp)', async () => {
      const result = await commandToggle(makeInteraction('g1'), makeCommand('giveaway', 'admin'));
      expect(result).toBeNull();
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('allows an individually-disabled additional utility command to be blocked', async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ guildId: 'g1', enabled: true, disabledCommands: ['say'] }),
      });
      const result = await commandToggle(makeInteraction('g1'), makeCommand('say', 'admin'));
      expect(result).toBe('🔧 Ta komenda jest wyłączona na tym serwerze.');
    });
  });
});
