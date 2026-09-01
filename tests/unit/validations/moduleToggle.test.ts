jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

const mockBirthdayFindOne = jest.fn();
jest.mock('../../../src/models/BirthdayConfiguration', () => ({
  BirthdayConfigurationModel: {
    findOne: (...args: unknown[]) => mockBirthdayFindOne(...args),
  },
}));

const mockLevelFindOne = jest.fn();
jest.mock('../../../src/models/LevelConfig', () => ({
  LevelConfigModel: {
    findOne: (...args: unknown[]) => mockLevelFindOne(...args),
  },
}));

const mockGiveawayFindOne = jest.fn();
jest.mock('../../../src/models/GiveawayConfig', () => ({
  GiveawayConfigModel: {
    findOne: (...args: unknown[]) => mockGiveawayFindOne(...args),
  },
}));

import moduleToggle from '../../../src/validations/moduleToggle';
import type { ICommand } from '../../../src/interfaces/Command';

function makeCommand(name: string): ICommand {
  return {
    data: { name } as unknown as ICommand['data'],
    run: jest.fn(),
  };
}

function makeInteraction(guildId: string | null) {
  return { guildId } as any;
}

function lean(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

describe('moduleToggle', () => {
  beforeEach(() => {
    mockBirthdayFindOne.mockReset();
    mockLevelFindOne.mockReset();
    mockGiveawayFindOne.mockReset();
  });

  it('allows DM usage (no guildId) without touching the database', async () => {
    const result = await moduleToggle(makeInteraction(null), makeCommand('birthday'));
    expect(result).toBeNull();
    expect(mockBirthdayFindOne).not.toHaveBeenCalled();
  });

  it('allows commands not covered by any gate without touching the database', async () => {
    const result = await moduleToggle(makeInteraction('g1'), makeCommand('ping'));
    expect(result).toBeNull();
    expect(mockBirthdayFindOne).not.toHaveBeenCalled();
    expect(mockLevelFindOne).not.toHaveBeenCalled();
    expect(mockGiveawayFindOne).not.toHaveBeenCalled();
  });

  describe('Urodziny (birthday, birthdays-next, birthday-remember, birthday-set-user)', () => {
    it.each(['birthday', 'birthdays-next', 'birthday-remember', 'birthday-set-user'])(
      'blocks "%s" when enabled is explicitly false',
      async (name) => {
        mockBirthdayFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: false }));
        const result = await moduleToggle(makeInteraction('g1'), makeCommand(name));
        expect(result).toBe('🔧 Moduł Urodziny jest wyłączony na tym serwerze.');
      }
    );

    it('allows the command when no config document exists yet', async () => {
      mockBirthdayFindOne.mockReturnValue(lean(null));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('birthday'));
      expect(result).toBeNull();
    });

    it('allows the command when enabled is true', async () => {
      mockBirthdayFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: true }));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('birthday'));
      expect(result).toBeNull();
    });
  });

  describe('Poziomy (level, toplvl, xp)', () => {
    it.each(['level', 'toplvl', 'xp'])('blocks "%s" when no config document exists', async (name) => {
      mockLevelFindOne.mockReturnValue(lean(null));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand(name));
      expect(result).toBe('🔧 Moduł Poziomy jest wyłączony na tym serwerze.');
    });

    it('blocks when enabled is explicitly false', async () => {
      mockLevelFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: false }));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('level'));
      expect(result).toBe('🔧 Moduł Poziomy jest wyłączony na tym serwerze.');
    });

    it('allows the command when enabled is true', async () => {
      mockLevelFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: true }));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('level'));
      expect(result).toBeNull();
    });
  });

  describe('Giveaway', () => {
    it('blocks "giveaway" when no config document exists', async () => {
      mockGiveawayFindOne.mockReturnValue(lean(null));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('giveaway'));
      expect(result).toBe('🔧 Moduł Giveaway jest wyłączony na tym serwerze.');
    });

    it('blocks when enabled is explicitly false', async () => {
      mockGiveawayFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: false }));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('giveaway'));
      expect(result).toBe('🔧 Moduł Giveaway jest wyłączony na tym serwerze.');
    });

    it('allows the command when enabled is true', async () => {
      mockGiveawayFindOne.mockReturnValue(lean({ guildId: 'g1', enabled: true }));
      const result = await moduleToggle(makeInteraction('g1'), makeCommand('giveaway'));
      expect(result).toBeNull();
    });
  });

  it('fails open (returns null) when the database throws', async () => {
    mockBirthdayFindOne.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('db down')) });
    const result = await moduleToggle(makeInteraction('g1'), makeCommand('birthday'));
    expect(result).toBeNull();
  });
});
